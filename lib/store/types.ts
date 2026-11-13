import type {
  Article,
  ArticleKind,
  ArticleStatus,
  AuditLogEntry,
  Category,
  Correction,
  EditorialUser,
  FactCheck,
  FactCheckStatus,
  FeedSource,
  Language,
  Submission,
  SubmissionStatus,
  Verdict,
} from "@/lib/types";

export type SortOrder = "latest" | "oldest" | "relevance";
export type DateRange = "any" | "week" | "month" | "year";

export interface ArticleQuery {
  categorySlug?: string;
  language?: Language | "all";
  state?: string | null;
  q?: string;
  status?: ArticleStatus | "all";
  featuredOnly?: boolean;
  underreportedOnly?: boolean;
  groundReportOnly?: boolean;
  kind?: ArticleKind;
  /** Restrict to one author — used by the freelance contributor desk. */
  authorId?: string;
  limit?: number;
  page?: number;
  perPage?: number;
  sort?: SortOrder;
  dateRange?: DateRange;
  excludeId?: string;
}

export interface FactCheckQuery {
  q?: string;
  verdict?: Verdict | "all";
  language?: Language | "all";
  status?: FactCheckStatus | "all";
  limit?: number;
  page?: number;
  perPage?: number;
  sort?: SortOrder;
  dateRange?: DateRange;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface SubmissionInput {
  type: Submission["type"];
  content: string;
  url?: string | null;
  imageUrl?: string | null;
  claimedSource?: string | null;
  language: Language;
  contactEmail?: string | null;
  submitterName?: string | null;
  ipHash?: string | null;
}

export interface ArticleInput {
  id?: string;
  slug?: string;
  title: string;
  subtitle?: string;
  summary: string;
  content: string;
  language: Language;
  categoryId: string;
  authorId: string;
  authorName?: string;
  imageUrl?: string | null;
  imageCaption?: string;
  imageCredit?: string;
  status: ArticleStatus;
  kind: ArticleKind;
  state?: string | null;
  tags?: string[];
  featured?: boolean;
  underreported?: boolean;
  groundReport?: boolean;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  sources?: Article["sources"];
  seoTitle?: string;
  seoDescription?: string;
}

export interface Stats {
  publishedArticles: number;
  drafts: number;
  pendingFactChecks: number;
  publishedFactChecks: number;
  openSubmissions: number;
  corrections: number;
  sources: number;
}

export interface DataStore {
  readonly backend: "firestore" | "sample";

  listCategories(): Promise<Category[]>;
  listArticles(query: ArticleQuery): Promise<ListResult<Article>>;
  getArticleBySlug(slug: string, opts?: { includeDrafts?: boolean }): Promise<Article | null>;
  getArticleById(id: string): Promise<Article | null>;
  getRelatedArticles(article: Article, limit?: number): Promise<Article[]>;
  saveArticle(input: ArticleInput, actor: { id: string; email?: string }): Promise<Article>;
  setArticleStatus(
    id: string,
    status: ArticleStatus,
    actor: { id: string; email?: string },
  ): Promise<Article | null>;

  listFactChecks(query: FactCheckQuery): Promise<ListResult<FactCheck>>;
  getFactCheckBySlug(slug: string): Promise<FactCheck | null>;
  getFactCheckById(id: string): Promise<FactCheck | null>;
  saveFactCheck(fc: FactCheck): Promise<FactCheck>;
  publishFactCheck(
    id: string,
    reviewer: { id: string; name: string; email?: string },
  ): Promise<FactCheck | null>;

  listCorrections(): Promise<Correction[]>;
  addCorrection(correction: Correction, actor: { id: string; email?: string }): Promise<Correction>;

  createSubmission(input: SubmissionInput): Promise<Submission>;
  listSubmissions(status?: SubmissionStatus | "all"): Promise<Submission[]>;
  updateSubmission(
    id: string,
    patch: Partial<Pick<Submission, "status" | "triageNote" | "claimId" | "factCheckId">>,
    actor: { id: string; email?: string },
  ): Promise<Submission | null>;

  listSources(): Promise<FeedSource[]>;
  saveSource(source: FeedSource): Promise<FeedSource>;

  listUsers(): Promise<EditorialUser[]>;
  /** Look up a freelance contributor's public profile by its URL slug. */
  getContributorBySlug(slug: string): Promise<EditorialUser | null>;
  updateContributorProfile(
    id: string,
    patch: Partial<Pick<EditorialUser, "name" | "slug" | "beats" | "bio" | "location" | "avatarUrl">>,
  ): Promise<EditorialUser | null>;
  setUserRole(id: string, role: EditorialUser["role"], actor: { id: string; email?: string }): Promise<EditorialUser | null>;

  listAuditLogs(limit?: number): Promise<AuditLogEntry[]>;
  appendAudit(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<void>;

  toggleBookmark(userId: string, articleId: string): Promise<boolean>;
  listBookmarks(userId: string): Promise<Article[]>;

  addNewsletterSubscriber(email: string): Promise<{ ok: boolean; alreadySubscribed: boolean }>;

  getStats(): Promise<Stats>;
}
