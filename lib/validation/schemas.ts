import { z } from "zod";

export const languageSchema = z.enum(["en", "hi"]);

export const verdictSchema = z.enum([
  "verified_true",
  "false",
  "misleading",
  "unverified",
  "outdated",
  "disputed",
]);

export const submissionSchema = z
  .object({
    type: z.enum(["viral_claim", "news_tip", "correction_request"]).default("viral_claim"),
    content: z
      .string()
      .trim()
      .min(20, "Please describe the claim in at least 20 characters.")
      .max(5000, "Please keep the submission under 5,000 characters."),
    url: z.string().trim().url("Enter a valid URL, or leave this empty.").max(500).optional().or(z.literal("")),
    claimedSource: z.string().trim().max(200).optional().or(z.literal("")),
    contactEmail: z.string().trim().email("Enter a valid email address.").max(200).optional().or(z.literal("")),
    submitterName: z.string().trim().max(120).optional().or(z.literal("")),
    language: languageSchema.default("en"),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Please confirm you understand how submissions are reviewed." }),
    }),
    imageUrl: z.string().trim().max(600).optional().or(z.literal("")),
  })
  .strict();

export type SubmissionPayload = z.infer<typeof submissionSchema>;

export const articleSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(8, "Headline is too short.").max(180),
  subtitle: z.string().trim().max(280).optional(),
  summary: z.string().trim().min(40, "Standfirst must be at least 40 characters.").max(600),
  content: z.string().trim().min(80, "Article body is too short."),
  language: languageSchema,
  categoryId: z.string().min(1, "Choose a section."),
  authorId: z.string().min(1),
  authorName: z.string().trim().max(120).optional(),
  kind: z.enum(["original", "summary", "external", "opinion", "explainer"]),
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
  imageUrl: z.string().trim().max(600).optional().or(z.literal("")),
  imageCaption: z.string().trim().max(240).optional(),
  imageCredit: z.string().trim().max(160).optional(),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(40)).max(8).optional(),
  featured: z.boolean().optional(),
  underreported: z.boolean().optional(),
  groundReport: z.boolean().optional(),
  publishedAt: z.string().optional().or(z.literal("")),
  sources: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
        publisher: z.string().optional(),
        publishedAt: z.string().nullable().optional(),
        accessedAt: z.string().optional(),
        type: z.enum([
          "government",
          "primary_record",
          "independent_journalism",
          "research",
          "opinion",
          "social_media",
          "other",
        ]),
        isPrimary: z.boolean().optional(),
        note: z.string().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export type ArticlePayload = z.infer<typeof articleSchema>;

export const correctionSchema = z.object({
  articleId: z.string().optional(),
  factCheckId: z.string().optional(),
  summaryEn: z.string().trim().min(10).max(280),
  summaryHi: z.string().trim().max(280).optional(),
  detailEn: z.string().trim().max(2000).optional(),
  detailHi: z.string().trim().max(2000).optional(),
  severity: z.enum(["minor", "material", "clarification"]),
});

export const factCheckDecisionSchema = z.object({
  id: z.string().min(1),
  verdict: verdictSchema,
  explanationEn: z.string().trim().min(40, "Explain the verdict in at least 40 characters."),
  contextEn: z.string().trim().min(20, "Add the context readers need."),
  confidenceLevel: z.enum(["low", "medium", "high"]),
  headlineEn: z.string().trim().min(8).max(200),
  notesForReviewer: z.string().trim().max(1000).optional(),
  action: z.enum(["save", "publish", "reject"]).default("save"),
});

export const newsletterSchema = z.object({
  email: z.string().trim().email().max(200),
});

export const bookmarkSchema = z.object({
  articleId: z.string().min(1),
});

export const researchRequestSchema = z.object({
  claimText: z.string().trim().min(20, "Describe the claim first.").max(5000),
  url: z.string().trim().url().max(500).optional().or(z.literal("")),
  language: languageSchema.default("en"),
  submissionId: z.string().optional(),
});

export const roleUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "editor", "researcher", "user"]),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
