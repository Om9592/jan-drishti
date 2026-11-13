import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type Query } from "firebase-admin/firestore";
import { COLLECTIONS, adminDb } from "@/lib/firebase/admin";
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

function db() {
  const database = adminDb();
  if (!database) throw new Error("Firestore admin SDK is not configured.");
  return database;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/**
 * Deep-convert Firestore values into plain JSON-safe ones.
 *
 * Server Components hand these objects straight to Client Components, and React
 * refuses to serialise a Timestamp (it is a class instance). Every list method
 * that can end up in a form or a table therefore runs its output through here.
 */
function plain<T>(value: T): T {
  if (value instanceof Timestamp) return value.toDate().toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map((item) => plain(item)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = plain(item);
    }
    return out as T;
  }
  return value;
}

function normaliseArticle(id: string, data: Record<string, unknown>): Article {
  return {
    ...(data as unknown as Article),
    id,
    publishedAt: toIso(data.publishedAt),
    updatedAt: toIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

function normaliseFactCheck(id: string, data: Record<string, unknown>): FactCheck {
  return {
    ...(data as unknown as FactCheck),
    id,
    verifiedAt: toIso(data.verifiedAt),
    publishedAt: toIso(data.publishedAt),
    updatedAt: toIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

function normaliseSubmission(id: string, data: Record<string, unknown>): Submission {
  return {
    ...(data as unknown as Submission),
    id,
    createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(data.updatedAt) ?? new Date().toISOString(),
  };
}

function searchTokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 1)
        .slice(0, 40),
    ),
  );
}

function withinRange(iso: string | null, range?: string): boolean {
  if (!range || range === "any") return true;
  if (!iso) return false;
  const days = range === "week" ? 7 : range === "month" ? 31 : 365;
  return Date.now() - new Date(iso).getTime() <= days * 86_400_000;
}

/**
 * Firestore can only answer an equality-filter + orderBy query when a composite
 * index exists. Indexes are deployed with `firebase deploy --only firestore:indexes`;
 * until that has run (a fresh project, or a new query shape), the query fails with
 * FAILED_PRECONDITION (code 9).
 *
 * Rather than 500-ing the whole site, we fall back to fetching the filtered set and
 * sorting it in memory. It is capped, logged, and only used while an index is
 * missing — the moment the index exists the fast path is taken again.
 */
const FAILED_PRECONDITION = 9;
const FALLBACK_SCAN_LIMIT = 500;

function isMissingIndex(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === FAILED_PRECONDITION;
}

function timeValue(value: unknown): number {
  const iso = toIso(value);
  return iso ? new Date(iso).getTime() : 0;
}

async function sortedDocs(
  sorted: Query,
  unsorted: Query,
  sortField: string,
  direction: "asc" | "desc",
  offset: number,
  pageSize: number,
): Promise<{ docs: FirebaseFirestore.QueryDocumentSnapshot[]; total: number; degraded: boolean }> {
  try {
    const countSnap = await sorted.count().get();
    let paged: Query = sorted;
    if (offset > 0) paged = paged.offset(offset);
    paged = paged.limit(pageSize);
    return { docs: (await paged.get()).docs, total: countSnap.data().count, degraded: false };
  } catch (error) {
    if (!isMissingIndex(error)) throw error;
    console.warn(
      `[firestore] missing composite index for ${sortField} — sorting in memory. Run: firebase deploy --only firestore:indexes`,
    );
    const all = (await unsorted.limit(FALLBACK_SCAN_LIMIT).get()).docs;
    all.sort((a, b) =>
      direction === "asc"
        ? timeValue(a.get(sortField)) - timeValue(b.get(sortField))
        : timeValue(b.get(sortField)) - timeValue(a.get(sortField)),
    );
    return { docs: all.slice(offset, offset + pageSize), total: all.length, degraded: true };
  }
}

export class FirestoreStore implements DataStore {
  readonly backend = "firestore" as const;

  async listCategories(): Promise<Category[]> {
    const snap = await db().collection(COLLECTIONS.categories).orderBy("order", "asc").get();
    return snap.docs.map((doc) => plain({ ...(doc.data() as Category), id: doc.id }));
  }

  async listArticles(query: ArticleQuery): Promise<ListResult<Article>> {
    const col = db().collection(COLLECTIONS.articles);
    const status = query.status ?? "published";
    const conditions: { field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }[] = [];
    if (status !== "all") conditions.push({ field: "status", op: "==", value: status });
    if (query.categorySlug) conditions.push({ field: "categorySlug", op: "==", value: query.categorySlug });
    if (query.language && query.language !== "all") conditions.push({ field: "language", op: "==", value: query.language });
    if (query.featuredOnly) conditions.push({ field: "featured", op: "==", value: true });
    if (query.underreportedOnly) conditions.push({ field: "underreported", op: "==", value: true });
    if (query.groundReportOnly) conditions.push({ field: "groundReport", op: "==", value: true });
    if (query.state) conditions.push({ field: "state", op: "==", value: query.state });
    if (query.authorId) conditions.push({ field: "authorId", op: "==", value: query.authorId });

    let base: Query = col;
    for (const c of conditions) base = base.where(c.field, c.op, c.value);
    if (query.q) {
      const tokensWanted = searchTokens(query.q).slice(0, 10);
      if (tokensWanted.length > 0) {
        base = base.where("keywords", "array-contains-any", tokensWanted);
      }
    }
    const direction = query.sort === "oldest" ? "asc" : "desc";
    const sorted = base.orderBy("publishedAt", direction);

    const pageSize = query.limit ?? query.perPage ?? 20;
    const page = query.page ?? 1;
    const offset = query.limit ? 0 : (page - 1) * pageSize;

    // Count first so pagination UI can show a total.
    const { docs, total } = await sortedDocs(sorted, base, "publishedAt", direction, offset, pageSize);
    let items = docs.map((doc) => normaliseArticle(doc.id, doc.data()));

    if (query.kind) items = items.filter((a) => a.kind === query.kind);
    if (query.excludeId) items = items.filter((a) => a.id !== query.excludeId);
    if (query.dateRange && query.dateRange !== "any") {
      items = items.filter((a) => withinRange(a.publishedAt, query.dateRange));
    }
    return { items, total };
  }

  async getArticleBySlug(slug: string, opts?: { includeDrafts?: boolean }): Promise<Article | null> {
    const snap = await db().collection(COLLECTIONS.articles).where("slug", "==", slug).limit(1).get();
    const doc = snap.docs[0];
    if (!doc) return null;
    const article = normaliseArticle(doc.id, doc.data());
    if (!opts?.includeDrafts && article.status !== "published") return null;
    return article;
  }

  async getArticleById(id: string): Promise<Article | null> {
    const doc = await db().collection(COLLECTIONS.articles).doc(id).get();
    if (!doc.exists) return null;
    return normaliseArticle(doc.id, doc.data() as Record<string, unknown>);
  }

  async getRelatedArticles(article: Article, limit = 4): Promise<Article[]> {
    const base = db()
      .collection(COLLECTIONS.articles)
      .where("status", "==", "published")
      .where("categorySlug", "==", article.categorySlug ?? "");
    const { docs } = await sortedDocs(base.orderBy("publishedAt", "desc"), base, "publishedAt", "desc", 0, limit + 1);
    return docs
      .map((doc) => normaliseArticle(doc.id, doc.data()))
      .filter((a) => a.id !== article.id)
      .slice(0, limit);
  }

  async saveArticle(input: ArticleInput, actor: { id: string; email?: string }): Promise<Article> {
    const col = db().collection(COLLECTIONS.articles);
    const existing = input.id ? await this.getArticleById(input.id) : null;
    const id = existing?.id ?? col.doc().id;
    const slug = input.slug?.trim() || existing?.slug || slugify(input.title);
    const now = new Date().toISOString();

    const categoryDoc = await db().collection(COLLECTIONS.categories).doc(input.categoryId).get();
    // A section may arrive as a document id (the editor) or as a slug (a feed,
    // or a writer posting straight to the API). Never leave it undefined —
    // Firestore rejects undefined values and the section would be unlinkable.
    let categorySlug = categoryDoc.exists ? (categoryDoc.data() as Category).slug : "";
    if (!categorySlug) {
      const bySlug = await db()
        .collection(COLLECTIONS.categories)
        .where("slug", "==", input.categoryId)
        .limit(1)
        .get();
      categorySlug = (bySlug.docs[0]?.data() as Category | undefined)?.slug ?? "";
    }

    const payload: Record<string, unknown> = {
      slug,
      title: input.title,
      subtitle: input.subtitle ?? "",
      summary: input.summary,
      content: input.content,
      language: input.language,
      categoryId: input.categoryId,
      categorySlug,
      authorId: input.authorId,
      authorName: input.authorName ?? "",
      imageUrl: input.imageUrl ?? null,
      imageCaption: input.imageCaption ?? "",
      imageCredit: input.imageCredit ?? "",
      status: input.status,
      kind: input.kind,
      state: input.state ?? null,
      tags: input.tags ?? [],
      keywords: searchTokens(`${input.title} ${input.subtitle ?? ""} ${input.summary} ${(input.tags ?? []).join(" ")}`),
      featured: input.featured ?? false,
      underreported: input.underreported ?? false,
      groundReport: input.groundReport ?? false,
      publishedAt:
        input.status === "published"
          ? existing?.publishedAt ?? input.publishedAt ?? now
          : input.publishedAt ?? null,
      scheduledFor: input.scheduledFor ?? null,
      readingMinutes: readingTime(input.content, input.language),
      sources: input.sources ?? existing?.sources ?? [],
      seoTitle: input.seoTitle ?? input.title,
      seoDescription: input.seoDescription ?? truncate(input.summary, 155),
      updatedAt: FieldValue.serverTimestamp(),
      ...(existing ? {} : { createdAt: FieldValue.serverTimestamp(), isSample: false }),
    };

    await col.doc(id).set(payload, { merge: true });
    await this.appendAudit({
      action: existing ? "article.updated" : "article.created",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "article",
      targetId: id,
      summary: `${existing ? "Updated" : "Created"} article “${input.title}” (${input.status}).`,
    });
    const saved = await this.getArticleById(id);
    if (!saved) throw new Error("Article save failed.");
    return saved;
  }

  async setArticleStatus(id: string, status: Article["status"], actor: { id: string; email?: string }) {
    const ref = db().collection(COLLECTIONS.articles).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const data = doc.data() as Article;
    await ref.set(
      {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt:
          status === "published" ? data.publishedAt ?? new Date().toISOString() : data.publishedAt ?? null,
      },
      { merge: true },
    );
    await this.appendAudit({
      action: `article.${status}`,
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "article",
      targetId: id,
      summary: `Article “${data.title}” set to ${status}.`,
    });
    return this.getArticleById(id);
  }

  async listFactChecks(query: FactCheckQuery): Promise<ListResult<FactCheck>> {
    const status = query.status ?? "published";
    let base: Query = db().collection(COLLECTIONS.factChecks);
    if (status !== "all") base = base.where("status", "==", status);
    if (query.verdict && query.verdict !== "all") base = base.where("verdict", "==", query.verdict);
    const direction = query.sort === "oldest" ? "asc" : "desc";
    const sorted = base.orderBy("publishedAt", direction);
    const pageSize = query.limit ?? query.perPage ?? 12;
    const page = query.page ?? 1;
    const offset = !query.limit && page > 1 ? (page - 1) * pageSize : 0;
    const { docs, total } = await sortedDocs(sorted, base, "publishedAt", direction, offset, pageSize);
    let items = docs.map((doc) => normaliseFactCheck(doc.id, doc.data()));
    if (query.q) {
      const needle = query.q.toLowerCase();
      items = items.filter((f) =>
        `${f.claimText} ${f.headlineEn} ${f.explanationEn}`.toLowerCase().includes(needle),
      );
    }
    return { items, total };
  }

  async getFactCheckBySlug(slug: string): Promise<FactCheck | null> {
    const snap = await db().collection(COLLECTIONS.factChecks).where("slug", "==", slug).limit(1).get();
    const doc = snap.docs[0];
    if (!doc) return null;
    const fc = normaliseFactCheck(doc.id, doc.data());
    return fc.status === "published" ? fc : null;
  }

  async getFactCheckById(id: string): Promise<FactCheck | null> {
    const doc = await db().collection(COLLECTIONS.factChecks).doc(id).get();
    if (!doc.exists) return null;
    return normaliseFactCheck(doc.id, doc.data() as Record<string, unknown>);
  }

  async saveFactCheck(fc: FactCheck): Promise<FactCheck> {
    const ref = db().collection(COLLECTIONS.factChecks).doc(fc.id);
    const { id: _id, ...rest } = fc;
    await ref.set({ ...rest, updatedAt: FieldValue.serverTimestamp(), keywords: searchTokens(`${fc.claimText} ${fc.headlineEn}`) }, { merge: true });
    return { ...fc, updatedAt: new Date().toISOString() };
  }

  async publishFactCheck(id: string, reviewer: { id: string; name: string; email?: string }) {
    const ref = db().collection(COLLECTIONS.factChecks).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const data = doc.data() as FactCheck;
    const now = new Date().toISOString();
    await ref.set(
      {
        status: "published",
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        verifiedAt: data.verifiedAt ?? now,
        publishedAt: data.publishedAt ?? now,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await this.appendAudit({
      action: "factcheck.published",
      actorId: reviewer.id,
      actorEmail: reviewer.email,
      targetType: "factCheck",
      targetId: id,
      summary: `Verdict “${data.verdict}” approved and published.`,
    });
    return this.getFactCheckById(id);
  }

  async listCorrections(): Promise<Correction[]> {
    const snap = await db()
      .collection(COLLECTIONS.corrections)
      .orderBy("date", "desc")
      .limit(200)
      .get();
    return snap.docs.map((doc) => plain({ ...(doc.data() as Correction), id: doc.id }));
  }

  async addCorrection(correction: Correction, actor: { id: string; email?: string }) {
    const id = correction.id || db().collection(COLLECTIONS.corrections).doc().id;
    const payload = { ...correction, id, createdAt: FieldValue.serverTimestamp() };
    await db().collection(COLLECTIONS.corrections).doc(id).set(payload);
    if (correction.articleId) {
      const ref = db().collection(COLLECTIONS.articles).doc(correction.articleId);
      await ref.set(
        {
          corrections: FieldValue.arrayUnion(correction),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    if (correction.factCheckId) {
      const ref = db().collection(COLLECTIONS.factChecks).doc(correction.factCheckId);
      await ref.set(
        {
          corrections: FieldValue.arrayUnion(correction),
          correctionVersion: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
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
    const ref = db().collection(COLLECTIONS.submissions).doc();
    const now = new Date().toISOString();
    await ref.set({
      ...input,
      status: "received",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const id = ref.id;
    await this.appendAudit({
      action: "submission.created",
      actorId: "public",
      targetType: "submission",
      targetId: id,
      summary: `New ${input.type} submission received.`,
    });
    return {
      id,
      ...input,
      type: input.type,
      status: "received",
      createdAt: now,
      updatedAt: now,
    } as Submission;
  }

  async listSubmissions(status?: Submission["status"] | "all"): Promise<Submission[]> {
    let base: Query = db().collection(COLLECTIONS.submissions);
    if (status && status !== "all") base = base.where("status", "==", status);
    const sorted = base.orderBy("createdAt", "desc");
    const { docs } = await sortedDocs(sorted, base, "createdAt", "desc", 0, 100);
    return docs.map((doc) => normaliseSubmission(doc.id, doc.data()));
  }

  async updateSubmission(
    id: string,
    patch: Partial<Pick<Submission, "status" | "triageNote" | "claimId" | "factCheckId">>,
    actor: { id: string; email?: string },
  ) {
    const ref = db().collection(COLLECTIONS.submissions).doc(id);
    await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await this.appendAudit({
      action: "submission.updated",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "submission",
      targetId: id,
      summary: `Submission moved to ${patch.status ?? "updated"}.`,
    });
    const doc = await ref.get();
    return doc.exists ? normaliseSubmission(doc.id, doc.data() as Record<string, unknown>) : null;
  }

  async listSources(): Promise<FeedSource[]> {
    const snap = await db().collection(COLLECTIONS.sources).get();
    return snap.docs.map((doc) => plain({ ...(doc.data() as FeedSource), id: doc.id }));
  }

  async saveSource(source: FeedSource): Promise<FeedSource> {
    const { id, ...rest } = source;
    await db().collection(COLLECTIONS.sources).doc(id).set(rest, { merge: true });
    return source;
  }

  async listUsers(): Promise<EditorialUser[]> {
    const snap = await db().collection(COLLECTIONS.users).limit(200).get();
    return snap.docs.map((doc) =>
      plain(
        {
          ...(doc.data() as EditorialUser),
          id: doc.id,
          createdAt: toIso((doc.data() as { createdAt?: unknown }).createdAt) ?? new Date().toISOString(),
        },
      ),
    );
  }

  async setUserRole(
    id: string,
    role: EditorialUser["role"],
    actor: { id: string; email?: string },
  ): Promise<EditorialUser | null> {
    await db().collection(COLLECTIONS.users).doc(id).set({ role }, { merge: true });
    await this.appendAudit({
      action: "user.role_changed",
      actorId: actor.id,
      actorEmail: actor.email,
      targetType: "user",
      targetId: id,
      summary: `Role changed to ${role}.`,
    });
    const doc = await db().collection(COLLECTIONS.users).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as EditorialUser), id: doc.id };
  }

  async listAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
    const snap = await db()
      .collection(COLLECTIONS.auditLogs)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        ...(data as unknown as AuditLogEntry),
        id: doc.id,
        createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
      };
    });
  }

  async appendAudit(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void> {
    await db().collection(COLLECTIONS.auditLogs).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  async toggleBookmark(userId: string, articleId: string): Promise<boolean> {
    const id = `${userId}_${articleId}`;
    const ref = db().collection(COLLECTIONS.bookmarks).doc(id);
    const doc = await ref.get();
    if (doc.exists) {
      await ref.delete();
      return false;
    }
    await ref.set({ userId, articleId, createdAt: FieldValue.serverTimestamp() });
    return true;
  }

  async listBookmarks(userId: string): Promise<Article[]> {
    const snap = await db().collection(COLLECTIONS.bookmarks).where("userId", "==", userId).limit(50).get();
    const ids = snap.docs.map((doc) => (doc.data() as { articleId: string }).articleId);
    if (ids.length === 0) return [];
    const articles = await Promise.all(ids.map((id) => this.getArticleById(id)));
    return articles.filter((a): a is Article => Boolean(a));
  }

  async addNewsletterSubscriber(email: string) {
    const normalised = email.toLowerCase();
    const ref = db().collection(COLLECTIONS.newsletter).doc(normalised.replace(/[^a-z0-9]/g, "_"));
    const doc = await ref.get();
    if (doc.exists) return { ok: true, alreadySubscribed: true };
    await ref.set({ email: normalised, createdAt: FieldValue.serverTimestamp(), confirmed: false });
    return { ok: true, alreadySubscribed: false };
  }

  async getStats(): Promise<Stats> {
    const [published, drafts, pendingFc, publishedFc, subs, corrections, sources] = await Promise.all([
      db().collection(COLLECTIONS.articles).where("status", "==", "published").count().get(),
      db().collection(COLLECTIONS.articles).where("status", "==", "draft").count().get(),
      db().collection(COLLECTIONS.factChecks).where("status", "==", "in_review").count().get(),
      db().collection(COLLECTIONS.factChecks).where("status", "==", "published").count().get(),
      db().collection(COLLECTIONS.submissions).where("status", "==", "received").count().get(),
      db().collection(COLLECTIONS.corrections).count().get(),
      db().collection(COLLECTIONS.sources).count().get(),
    ]);
    return {
      publishedArticles: published.data().count,
      drafts: drafts.data().count,
      pendingFactChecks: pendingFc.data().count,
      publishedFactChecks: publishedFc.data().count,
      openSubmissions: subs.data().count,
      corrections: corrections.data().count,
      sources: sources.data().count,
    };
  }
}

export const newId = () => randomUUID();
