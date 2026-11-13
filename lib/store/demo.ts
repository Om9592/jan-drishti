import "server-only";
import { randomUUID } from "node:crypto";
import {
  SAMPLE_ARTICLES,
  SAMPLE_AUDIT,
  SAMPLE_CATEGORIES,
  SAMPLE_CORRECTIONS_LIST,
  SAMPLE_FACT_CHECKS,
  SAMPLE_SOURCES,
  SAMPLE_SUBMISSIONS,
  SAMPLE_USERS,
} from "@/lib/content/sample";
import type {
  Article,
  AuditLogEntry,
  Category,
  Correction,
  EditorialUser,
  FactCheck,
  FeedSource,
  Submission,
} from "@/lib/types";
import { readingTime, slugify, truncate } from "@/lib/utils";
import type {
  ArticleInput,
  ArticleQuery,
  DataStore,
  FactCheckQuery,
  ListResult,
  Stats,
  SubmissionInput,
} from "@/lib/store/types";

/**
 * In-memory data store used when Firebase credentials are absent.
 *
 * Its purpose is to let the full product be exercised end-to-end (submit →
 * research → review → publish) in preview. It is explicitly *not* a
 * production database: state lives in the Node process and resets on
 * redeploy. Every record it seeds is flagged `isSample`.
 */

interface DemoState {
  articles: Article[];
  factChecks: FactCheck[];
  submissions: Submission[];
  categories: Category[];
  sources: FeedSource[];
  users: EditorialUser[];
  corrections: Correction[];
  audit: AuditLogEntry[];
  bookmarks: Record<string, string[]>;
  newsletter: Set<string>;
}

declare global {
  // eslint-disable-next-line no-var
  var __jdDemoStore: DemoState | undefined;
}

function seed(): DemoState {
  return {
    articles: SAMPLE_ARTICLES.map((a) => ({ ...a })),
    factChecks: SAMPLE_FACT_CHECKS.map((f) => ({ ...f })),
    submissions: SAMPLE_SUBMISSIONS.map((s) => ({ ...s })),
    categories: SAMPLE_CATEGORIES.map((c) => ({ ...c })),
    sources: SAMPLE_SOURCES.map((s) => ({ ...s })),
    users: SAMPLE_USERS.map((u) => ({ ...u })),
    corrections: SAMPLE_CORRECTIONS_LIST.map((c) => ({ ...c })),
    audit: SAMPLE_AUDIT.map((a) => ({ ...a })),
    bookmarks: {},
    newsletter: new Set<string>(),
  };
}

function state(): DemoState {
  if (!globalThis.__jdDemoStore) globalThis.__jdDemoStore = seed();
  return globalThis.__jdDemoStore;
}

function categorySlug(id: string): string | undefined {
  return state().categories.find((c) => c.id === id)?.slug;
}

function withCategory(article: Article): Article {
  return { ...article, categorySlug: categorySlug(article.categoryId) ?? article.categorySlug };
}

function tokens(q: string): string[] {
  return q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);
}

function textMatches(haystack: string, q: string): boolean {
  const hay = haystack.toLowerCase();
  const parts = tokens(q);
  if (parts.length === 0) return true;
  return parts.every((t) => hay.includes(t));
}

function withinRange(iso: string | null, range: string): boolean {
  if (!range || range === "any") return true;
  if (!iso) return false;
  const time = new Date(iso).getTime();
  const days = range === "week" ? 7 : range === "month" ? 31 : 365;
  return Date.now() - time <= days * 86_400_000;
}

export class DemoStore implements DataStore {
  readonly backend = "sample" as const;

  async listCategories(): Promise<Category[]> {
    return [...state().categories].sort((a, b) => a.order - b.order);
  }

  async listArticles(query: ArticleQuery): Promise<ListResult<Article>> {
    const status = query.status ?? "published";
    let items = state().articles.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (query.categorySlug && categorySlug(a.categoryId) !== query.categorySlug) return false;
      if (query.language && query.language !== "all" && a.language !== query.language) return false;
      if (query.state && a.state !== query.state) return false;
      if (query.authorId && a.authorId !== query.authorId) return false;
      if (query.featuredOnly && !a.featured) return false;
      if (query.underreportedOnly && !a.underreported) return false;
      if (query.groundReportOnly && !a.groundReport) return false;
      if (query.kind && a.kind !== query.kind) return false;
      if (query.excludeId && a.id === query.excludeId) return false;
      if (!withinRange(a.publishedAt ?? a.updatedAt, query.dateRange ?? "any")) return false;
      if (query.q) {
        const hay = `${a.title} ${a.subtitle ?? ""} ${a.summary} ${(a.tags ?? []).join(" ")}`;
        if (!textMatches(hay, query.q)) return false;
      }
      return true;
    });

    items = items.sort((a, b) => {
      const at = new Date(a.publishedAt ?? a.updatedAt).getTime();
      const bt = new Date(b.publishedAt ?? b.updatedAt).getTime();
      return query.sort === "oldest" ? at - bt : bt - at;
    });

    const total = items.length;
    const limit = query.limit ?? query.perPage ?? total;
    const page = query.page ?? 1;
    const offset = query.limit ? 0 : (page - 1) * (query.perPage ?? limit);
    return {
      items: items.slice(offset, offset + limit).map(withCategory),
      total,
    };
  }

  async getArticleBySlug(slug: string, opts?: { includeDrafts?: boolean }): Promise<Article | null> {
    const found = state().articles.find(
      (a) => a.slug === slug && (opts?.includeDrafts || a.status === "published"),
    );
    return found ? withCategory(found) : null;
  }

  async getArticleById(id: string): Promise<Article | null> {
    const found = state().articles.find((a) => a.id === id);
    return found ? withCategory(found) : null;
  }

  async getRelatedArticles(article: Article, limit = 4): Promise<Article[]> {
    const pool = state().articles.filter(
      (a) => a.id !== article.id && a.status === "published" && a.categoryId === article.categoryId,
    );
    const fill = state().articles.filter(
      (a) => a.id !== article.id && a.status === "published" && a.categoryId !== article.categoryId,
    );
    return [...pool, ...fill].slice(0, limit).map(withCategory);
  }

  async saveArticle(input: ArticleInput, actor: { id: string; email?: string }): Promise<Article> {
    const existing = input.id ? state().articles.find((a) => a.id === input.id) : undefined;
    const id = existing?.id ?? `art-${randomUUID()}`;
    const slug = input.slug?.trim() || existing?.slug || slugify(input.title);
    const publishedAt =
      input.status === "published"
        ? existing?.publishedAt ?? input.publishedAt ?? new Date().toISOString()
        : input.publishedAt ?? null;
    const article: Article = {
      id,
      slug,
      title: input.title,
      subtitle: input.subtitle,
      summary: input.summary,
      content: input.content,
      language: input.language,
      categoryId: input.categoryId,
      authorId: input.authorId,
      authorName: input.authorName,
      imageUrl: input.imageUrl ?? existing?.imageUrl ?? null,
      imageCaption: input.imageCaption,
      imageCredit: input.imageCredit,
      status: input.status,
      kind: input.kind,
      state: input.state ?? null,
      tags: input.tags ?? [],
      featured: input.featured ?? false,
      underreported: input.underreported ?? false,
      groundReport: input.groundReport ?? false,
      publishedAt,
      updatedAt: new Date().toISOString(),
      readingMinutes: readingTime(input.content, input.language),
      sources: input.sources ?? existing?.sources ?? [],
      seoTitle: input.seoTitle ?? input.title,
      seoDescription: input.seoDescription ?? truncate(input.summary, 155),
      isSample: existing?.isSample ?? false,
    };
    if (existing) {
      Object.assign(existing, article);
    } else {
      state().articles.unshift(article);
    }
    await this.appendAudit({
      action: existing ? "article.updated" : "article.created",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "article",
      targetId: id,
      summary: `${existing ? "Updated" : "Created"} article “${input.title}” (${input.status}).`,
    });
    return withCategory(article);
  }

  async setArticleStatus(id: string, status: Article["status"], actor: { id: string; email?: string }) {
    const article = state().articles.find((a) => a.id === id);
    if (!article) return null;
    article.status = status;
    article.updatedAt = new Date().toISOString();
    if (status === "published" && !article.publishedAt) article.publishedAt = new Date().toISOString();
    if (status !== "published") article.publishedAt = article.publishedAt ?? null;
    await this.appendAudit({
      action: `article.${status}`,
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "article",
      targetId: id,
      summary: `Article “${article.title}” set to ${status}.`,
    });
    return withCategory(article);
  }

  async listFactChecks(query: FactCheckQuery): Promise<ListResult<FactCheck>> {
    const status = query.status ?? "published";
    let items = state().factChecks.filter((f) => {
      if (status !== "all" && f.status !== status) return false;
      if (query.verdict && query.verdict !== "all" && f.verdict !== query.verdict) return false;
      if (query.language && query.language !== "all" && f.claimLanguage !== query.language) return false;
      if (!withinRange(f.publishedAt ?? f.updatedAt, query.dateRange ?? "any")) return false;
      if (query.q) {
        const hay = `${f.claimText} ${f.headlineEn} ${f.explanationEn} ${(f.tags ?? []).join(" ")}`;
        if (!textMatches(hay, query.q)) return false;
      }
      return true;
    });
    items = items.sort((a, b) => {
      const at = new Date(a.publishedAt ?? a.updatedAt).getTime();
      const bt = new Date(b.publishedAt ?? b.updatedAt).getTime();
      return query.sort === "oldest" ? at - bt : bt - at;
    });
    const total = items.length;
    const page = query.page ?? 1;
    const perPage = query.limit ?? query.perPage ?? total;
    const offset = query.limit ? 0 : (page - 1) * perPage;
    return { items: items.slice(offset, offset + perPage), total };
  }

  async getFactCheckBySlug(slug: string): Promise<FactCheck | null> {
    return state().factChecks.find((f) => f.slug === slug && f.status === "published") ?? null;
  }

  async getFactCheckById(id: string): Promise<FactCheck | null> {
    return state().factChecks.find((f) => f.id === id) ?? null;
  }

  async saveFactCheck(fc: FactCheck): Promise<FactCheck> {
    const index = state().factChecks.findIndex((f) => f.id === fc.id);
    const next = { ...fc, updatedAt: new Date().toISOString() };
    if (index >= 0) state().factChecks[index] = next;
    else state().factChecks.unshift(next);
    return next;
  }

  async publishFactCheck(id: string, reviewer: { id: string; name: string; email?: string }) {
    const fc = state().factChecks.find((f) => f.id === id);
    if (!fc) return null;
    const now = new Date().toISOString();
    fc.status = "published";
    fc.reviewerId = reviewer.id;
    fc.reviewerName = reviewer.name;
    fc.verifiedAt = fc.verifiedAt ?? now;
    fc.publishedAt = fc.publishedAt ?? now;
    fc.updatedAt = now;
    await this.appendAudit({
      action: "factcheck.published",
      actorId: reviewer.id,
      actorEmail: reviewer.email,
      targetType: "factCheck",
      targetId: id,
      summary: `Verdict “${fc.verdict}” approved and published for claim ${fc.claimId}.`,
    });
    return fc;
  }

  async listCorrections(): Promise<Correction[]> {
    const articleCorrections = state()
      .articles.flatMap((a) => (a.corrections ?? []).map((c) => ({ ...c, articleId: a.id })));
    const factCheckCorrections = state()
      .factChecks.flatMap((f) => (f.corrections ?? []).map((c) => ({ ...c, factCheckId: f.id })));
    return [...state().corrections, ...articleCorrections, ...factCheckCorrections].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  async addCorrection(correction: Correction, actor: { id: string; email?: string }) {
    state().corrections.unshift({ ...correction, id: correction.id || `corr-${randomUUID()}` });
    if (correction.articleId) {
      const article = state().articles.find((a) => a.id === correction.articleId);
      if (article) {
        article.corrections = [...(article.corrections ?? []), correction];
        article.updatedAt = new Date().toISOString();
      }
    }
    if (correction.factCheckId) {
      const fc = state().factChecks.find((f) => f.id === correction.factCheckId);
      if (fc) {
        fc.corrections = [...(fc.corrections ?? []), correction];
        fc.correctionVersion = (fc.correctionVersion ?? 0) + 1;
        fc.updatedAt = new Date().toISOString();
      }
    }
    await this.appendAudit({
      action: "correction.created",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: correction.articleId ? "article" : "factCheck",
      targetId: correction.articleId ?? correction.factCheckId ?? "unknown",
      summary: correction.summaryEn,
    });
    return correction;
  }

  async createSubmission(input: SubmissionInput): Promise<Submission> {
    const now = new Date().toISOString();
    const submission: Submission = {
      id: `sub-${randomUUID()}`,
      type: input.type,
      content: input.content,
      url: input.url ?? null,
      imageUrl: input.imageUrl ?? null,
      claimedSource: input.claimedSource ?? null,
      language: input.language,
      contactEmail: input.contactEmail ?? null,
      submitterName: input.submitterName ?? null,
      status: "received",
      createdAt: now,
      updatedAt: now,
      ipHash: input.ipHash ?? null,
    };
    state().submissions.unshift(submission);
    await this.appendAudit({
      action: "submission.created",
      actorId: "public",
      targetType: "submission",
      targetId: submission.id,
      summary: `New ${input.type} submission received.`,
    });
    return submission;
  }

  async listSubmissions(status?: Submission["status"] | "all"): Promise<Submission[]> {
    const items = state().submissions.filter((s) => !status || status === "all" || s.status === status);
    return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateSubmission(
    id: string,
    patch: Partial<Pick<Submission, "status" | "triageNote" | "claimId" | "factCheckId">>,
    actor: { id: string; email?: string },
  ) {
    const submission = state().submissions.find((s) => s.id === id);
    if (!submission) return null;
    Object.assign(submission, patch, { updatedAt: new Date().toISOString() });
    await this.appendAudit({
      action: "submission.updated",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "submission",
      targetId: id,
      summary: `Submission moved to ${patch.status ?? submission.status}.`,
    });
    return submission;
  }

  async listSources(): Promise<FeedSource[]> {
    return [...state().sources];
  }

  async saveSource(source: FeedSource): Promise<FeedSource> {
    const index = state().sources.findIndex((s) => s.id === source.id);
    if (index >= 0) state().sources[index] = source;
    else state().sources.push(source);
    return source;
  }

  async listUsers(): Promise<EditorialUser[]> {
    return [...state().users];
  }

  async getContributorBySlug(slug: string): Promise<EditorialUser | null> {
    return state().users.find((u) => u.slug === slug && u.role === "contributor") ?? null;
  }

  async updateContributorProfile(
    id: string,
    patch: Partial<Pick<EditorialUser, "name" | "slug" | "beats" | "bio" | "location" | "avatarUrl">>,
  ): Promise<EditorialUser | null> {
    const user = state().users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    return user;
  }

  async setUserRole(
    id: string,
    role: EditorialUser["role"],
    actor: { id: string; email?: string },
  ): Promise<EditorialUser | null> {
    const user = state().users.find((u) => u.id === id);
    if (!user) return null;
    user.role = role;
    await this.appendAudit({
      action: "user.role_changed",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "user",
      targetId: id,
      summary: `Role for ${user.email} changed to ${role}.`,
    });
    return user;
  }

  async listAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
    return [...state().audit]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async appendAudit(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void> {
    state().audit.unshift({ ...entry, id: `audit-${randomUUID()}`, createdAt: new Date().toISOString() });
  }

  async toggleBookmark(userId: string, articleId: string): Promise<boolean> {
    const list = new Set(state().bookmarks[userId] ?? []);
    const nowSaved = !list.has(articleId);
    if (nowSaved) list.add(articleId);
    else list.delete(articleId);
    state().bookmarks[userId] = [...list];
    return nowSaved;
  }

  async listBookmarks(userId: string): Promise<Article[]> {
    const ids = state().bookmarks[userId] ?? [];
    return state()
      .articles.filter((a) => ids.includes(a.id))
      .map(withCategory);
  }

  async addNewsletterSubscriber(email: string) {
    const normalised = email.toLowerCase();
    const alreadySubscribed = state().newsletter.has(normalised);
    state().newsletter.add(normalised);
    if (!alreadySubscribed) {
      await this.appendAudit({
        action: "newsletter.subscribed",
        actorId: "public",
        targetType: "newsletter",
        targetId: normalised.slice(0, 3) + "***",
        summary: "Newsletter subscription.",
      });
    }
    return { ok: true, alreadySubscribed };
  }

  async getStats(): Promise<Stats> {
    const articles = state().articles;
    return {
      publishedArticles: articles.filter((a) => a.status === "published").length,
      drafts: articles.filter((a) => a.status !== "published").length,
      pendingFactChecks: state().factChecks.filter((f) => f.status !== "published").length,
      publishedFactChecks: state().factChecks.filter((f) => f.status === "published").length,
      openSubmissions: state().submissions.filter((s) => s.status !== "published" && s.status !== "rejected").length,
      corrections: (await this.listCorrections()).length,
      sources: state().sources.length,
    };
  }
}
