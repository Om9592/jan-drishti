/**
 * Domain types for Jan Drishti.
 * Firestore documents map 1:1 to these shapes (see lib/store/firestore.ts).
 */

export type Language = "en" | "hi";

export type Role = "admin" | "editor" | "researcher" | "contributor" | "user";

export type ArticleStatus = "draft" | "review" | "scheduled" | "published" | "archived";

/** Editorial provenance — shown on every article so readers always know what they are reading. */
export type ArticleKind = "original" | "summary" | "external" | "opinion" | "explainer";

export type Verdict =
  | "verified_true"
  | "false"
  | "misleading"
  | "unverified"
  | "outdated"
  | "disputed";

export type FactCheckStatus = "draft" | "research" | "in_review" | "published" | "rejected";

export type SubmissionStatus = "received" | "triaged" | "researching" | "published" | "rejected";

export type SourceType =
  | "government"
  | "primary_record"
  | "independent_journalism"
  | "research"
  | "opinion"
  | "social_media"
  | "other";

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string;
  descriptionEn?: string;
  descriptionHi?: string;
  order: number;
  showOnHome: boolean;
}

export interface Author {
  id: string;
  name: string;
  role?: string;
  bioEn?: string;
  bioHi?: string;
  avatarUrl?: string;
}

export interface SourceRef {
  id: string;
  name: string;
  url: string;
  publisher?: string;
  publishedAt?: string | null;
  accessedAt?: string;
  type: SourceType;
  isPrimary?: boolean;
  note?: string;
}

export interface Correction {
  id: string;
  articleId?: string;
  factCheckId?: string;
  date: string;
  summaryEn: string;
  summaryHi?: string;
  detailEn?: string;
  detailHi?: string;
  issuedBy: string;
  severity: "minor" | "material" | "clarification";
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  summary: string;
  /** Sanitised, trusted HTML authored in the editorial dashboard. */
  content: string;
  language: Language;
  categoryId: string;
  categorySlug?: string;
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
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes?: number;
  sourceIds?: string[];
  sources?: SourceRef[];
  translationGroupId?: string;
  corrections?: Correction[];
  isSample?: boolean;
  views?: number;
  seoTitle?: string;
  seoDescription?: string;
  /** Set on wire items: the canonical URL at the original publisher. */
  sourceUrl?: string | null;
  /** Set on wire items: the publisher's name as shown to readers. */
  sourceName?: string | null;
}

export interface Claim {
  id: string;
  text: string;
  language: Language;
  channel: "whatsapp" | "social" | "url" | "screenshot" | "email" | "other";
  submittedBy?: string | null;
  submittedAt: string;
  submissionId?: string;
  entities?: string[];
  status: SubmissionStatus;
}

export interface Evidence {
  id: string;
  claimId: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt?: string | null;
  retrievedAt: string;
  sourceType: SourceType;
  stance: "supports" | "contradicts" | "context";
  quote?: string;
  relevance?: number;
  noteEn?: string;
  noteHi?: string;
  isPrimary?: boolean;
}

export interface ResearchStep {
  key: string;
  labelEn: string;
  labelHi: string;
  status: "done" | "skipped" | "unavailable" | "pending";
  detail?: string;
}

export interface ResearchReport {
  id: string;
  claimId: string;
  generatedAt: string;
  model?: string;
  aiConfigured: boolean;
  searchConfigured: boolean;
  extractedClaims: { text: string; type: "factual" | "opinion" | "prediction"; entities?: string[] }[];
  queries: string[];
  evidenceIds: string[];
  supportingSummaryEn: string;
  contradictingSummaryEn: string;
  missingContextEn: string;
  preliminaryVerdict: Verdict;
  confidence: "low" | "medium" | "high";
  steps: ResearchStep[];
  /** Always true for machine output. Cleared only by a human editor on approval. */
  preliminary: true;
}

export interface FactCheck {
  id: string;
  slug: string;
  claimId: string;
  claimText: string;
  claimLanguage: Language;
  headlineEn: string;
  headlineHi?: string;
  verdict: Verdict;
  explanationEn: string;
  explanationHi?: string;
  contextEn: string;
  contextHi?: string;
  supportingEvidence: Evidence[];
  contradictingEvidence: Evidence[];
  importantContext: Evidence[];
  sourceUrls: string[];
  claimFirstSeen?: string | null;
  verifiedAt: string | null;
  publishedAt: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  confidenceLevel: "low" | "medium" | "high";
  status: FactCheckStatus;
  correctionVersion: number;
  corrections?: Correction[];
  research?: ResearchReport | null;
  tags?: string[];
  isSample?: boolean;
  updatedAt: string;
  notesForReviewer?: string;
}

export interface Submission {
  id: string;
  type: "viral_claim" | "news_tip" | "correction_request" | "contributor_application";
  content: string;
  url?: string | null;
  imageUrl?: string | null;
  claimedSource?: string | null;
  language: Language;
  contactEmail?: string | null;
  submitterName?: string | null;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  claimId?: string | null;
  factCheckId?: string | null;
  triageNote?: string | null;
  ipHash?: string | null;
  isSample?: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail?: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface EditorialUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastSeenAt?: string;
  status: "active" | "invited" | "suspended";
  bookmarks?: string[];
}

export interface Bookmark {
  id: string;
  userId: string;
  articleId: string;
  createdAt: string;
}

export interface TranslationLink {
  id: string;
  translationGroupId: string;
  language: Language;
  articleId: string;
  title: string;
  slug: string;
}

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  publisher: string;
  type: SourceType;
  enabled: boolean;
  language: Language;
  lastFetchedAt?: string | null;
  lastStatus?: "ok" | "error" | "never";
  notes?: string;
}

export interface Viewer {
  uid: string;
  email: string | null;
  name: string | null;
  role: Role;
  /** True when the app runs without Firebase credentials (sample/demo mode). */
  demo: boolean;
  authenticated: boolean;
}
