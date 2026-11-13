import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb, COLLECTIONS } from "@/lib/firebase/admin";
import { runResearch } from "@/lib/research/engine";
import { getStore } from "@/lib/store";
import type { FactCheck, Language, ResearchReport, Submission } from "@/lib/types";
import { slugify, truncate } from "@/lib/utils";

export interface CreateResearchInput {
  claimText: string;
  language: Language;
  url?: string | null;
  submissionId?: string | null;
  actor: { id: string; email?: string; name?: string };
}

export interface CreateResearchOutput {
  factCheck: FactCheck;
  report: ResearchReport;
  submission: Submission | null;
}

/**
 * Turns a raw claim into a reviewable fact-check draft.
 *
 * The draft is created with status `research` and the machine report attached.
 * It is *never* published here — see `publishFactCheck` (role-gated) and the
 * /admin/fact-checks/[id] review screen.
 */
export async function createResearchDraft(input: CreateResearchInput): Promise<CreateResearchOutput> {
  const store = getStore();
  const claimId = `claim-${randomUUID()}`;
  const { report, evidence } = await runResearch({
    claimId,
    claimText: input.claimText,
    language: input.language,
    url: input.url,
    submissionId: input.submissionId,
  });

  const supporting = evidence.filter((e) => e.stance === "supports");
  const contradicting = evidence.filter((e) => e.stance === "contradicts");
  const context = evidence.filter((e) => e.stance === "context");

  const now = new Date().toISOString();
  const factCheck: FactCheck = {
    id: `fc-${randomUUID()}`,
    slug: `${slugify(truncate(input.claimText, 60)) || "fact-check"}-${claimId.slice(-6)}`,
    claimId,
    claimText: input.claimText,
    claimLanguage: input.language,
    headlineEn: truncate(`Claim check: ${input.claimText}`, 180),
    verdict: report.preliminaryVerdict,
    explanationEn: report.supportingSummaryEn || report.contradictingSummaryEn || "",
    contextEn: report.missingContextEn,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    importantContext: context,
    sourceUrls: evidence.map((e) => e.url),
    claimFirstSeen: null,
    verifiedAt: null,
    publishedAt: null,
    reviewerId: null,
    reviewerName: null,
    confidenceLevel: report.confidence,
    status: "research",
    correctionVersion: 0,
    research: report,
    tags: [],
    isSample: store.backend === "sample",
    updatedAt: now,
    notesForReviewer:
      "Preliminary machine research. An editor must verify every evidence item, write the explanation, and approve the verdict before publication.",
  };

  await store.saveFactCheck(factCheck);

  // Persist the claim + evidence documents when Firestore is available, so the
  // evidence file survives independently of the review screen.
  const db = adminDb();
  if (db) {
    try {
      await db.collection(COLLECTIONS.claims).doc(claimId).set({
        text: input.claimText,
        language: input.language,
        channel: input.url ? "url" : "whatsapp",
        submittedAt: now,
        submissionId: input.submissionId ?? null,
        status: "researching",
      });
      const batch = db.batch();
      for (const item of evidence) {
        batch.set(db.collection(COLLECTIONS.evidence).doc(item.id), {
          ...item,
          retrievedAt: now,
        });
      }
      await batch.commit();
    } catch (error) {
      console.error("[research] failed to persist claim/evidence documents", error);
    }
  }

  let submission: Submission | null = null;
  if (input.submissionId) {
    submission = await store.updateSubmission(
      input.submissionId,
      { status: "researching", claimId, factCheckId: factCheck.id },
      { id: input.actor.id, email: input.actor.email },
    );
  }

  await store.appendAudit({
    action: "research.completed",
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    targetType: "factCheck",
    targetId: factCheck.id,
    summary: `Research file created for claim ${claimId}. AI configured: ${report.aiConfigured}. Search configured: ${report.searchConfigured}.`,
  });

  return { factCheck, report, submission };
}

/**
 * Human approval gate. Only an editor/admin may call this; the role check
 * happens in the route handler before this function runs.
 */
export async function approveAndPublish(
  factCheckId: string,
  decision: {
    verdict: FactCheck["verdict"];
    explanationEn: string;
    contextEn: string;
    headlineEn: string;
    confidenceLevel: FactCheck["confidenceLevel"];
    notesForReviewer?: string;
  },
  reviewer: { id: string; name: string; email?: string },
): Promise<FactCheck | null> {
  const store = getStore();
  const existing = await store.getFactCheckById(factCheckId);
  if (!existing) return null;

  const updated = await store.saveFactCheck({
    ...existing,
    verdict: decision.verdict,
    explanationEn: decision.explanationEn,
    contextEn: decision.contextEn,
    headlineEn: decision.headlineEn,
    confidenceLevel: decision.confidenceLevel,
    notesForReviewer: decision.notesForReviewer ?? existing.notesForReviewer,
    status: "in_review",
  });

  return store.publishFactCheck(updated.id, reviewer);
}
