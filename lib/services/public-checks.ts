import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb, COLLECTIONS } from "@/lib/firebase/admin";
import { runResearch } from "@/lib/research/engine";
import type { AnalystAssessment, Evidence, Language, Verdict } from "@/lib/types";

/**
 * The public "check this now" path.
 *
 * A reader asks a question, the machine answers it directly. Nothing here is
 * editorial: no fact-check is created, no verdict is published to the archive,
 * and the answer is labelled as machine output wherever it is shown. Every run
 * is written to `publicChecks` so the desk gets a record of exactly what the
 * site told the public, with the sources it used.
 */

export interface PublicAnswerSource {
  title: string;
  url: string;
  publisher: string;
  sourceType: string;
  stance: "supports" | "contradicts" | "context";
  noteEn?: string;
}

export interface PublicAnswer {
  id: string;
  claim: string;
  language: Language;
  verdict: Verdict;
  confidence: "low" | "medium" | "high";
  headline: string;
  supporting: string;
  contradicting: string;
  missingContext: string;
  sources: PublicAnswerSource[];
  analysts: { provider: string; model: string; verdict: string; confidence: string; agrees: boolean }[];
  reCheck: string;
  publishers: number;
  evidenceChecked: number;
  sourcesUsed: string[];
  durationMs: number;
  model: string | null;
  flags: string[];
  createdAt: string;
  /** True when the answer is machine output shown to a reader, not an editorial verdict. */
  machine: true;
}

export interface PublicCheckRecord extends PublicAnswer {
  ipHash: string | null;
}

const MAX_PUBLIC_SOURCES = 8;

function publisherOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** Verdicts a machine may state plainly to a reader, versus ones it may only flag. */
function flagsFor(input: {
  verdict: Verdict;
  publishers: number;
  evidenceChecked: number;
  analysts: AnalystAssessment[];
  reCheck: string;
}): string[] {
  const flags: string[] = [];
  if (input.publishers < 3) flags.push("thin-sourcing");
  if (input.evidenceChecked === 0) flags.push("no-evidence");
  const verdicts = new Set(input.analysts.map((analyst) => analyst.preliminaryVerdict));
  if (verdicts.size > 1) flags.push("analysts-split");
  if (/re-check unavailable/i.test(input.reCheck)) flags.push("no-re-check");
  if (input.analysts.length < 2) flags.push("single-model");
  if (input.verdict === "unverified") flags.push("unverified");
  return flags;
}

function headlineFor(verdict: Verdict, claim: string): string {
  const short = claim.length > 110 ? `${claim.slice(0, 107).trimEnd()}…` : claim;
  switch (verdict) {
    case "verified_true":
      return `Evidence supports this: ${short}`;
    case "false":
      return `No support in the record: ${short}`;
    case "misleading":
      return `Partly accurate, misleading as shared: ${short}`;
    case "outdated":
      return `Was true, no longer current: ${short}`;
    case "disputed":
      return `Sources disagree: ${short}`;
    default:
      return `Not enough evidence to confirm: ${short}`;
  }
}

export async function answerPublicCheck(input: {
  claim: string;
  language: Language;
  ipHash: string | null;
}): Promise<PublicAnswer> {
  const claimId = `ask-${randomUUID()}`;
  const { report, evidence } = await runResearch({
    claimId,
    claimText: input.claim,
    language: input.language,
    url: null,
    submissionId: null,
  });

  const ranked: Evidence[] = [...evidence].sort((a, b) => {
    const rank = (item: Evidence) =>
      item.sourceType === "primary_record" ? 0 : item.sourceType === "government" ? 1 : item.sourceType === "independent_journalism" ? 2 : 3;
    return rank(a) - rank(b);
  });

  const sources: PublicAnswerSource[] = ranked.slice(0, MAX_PUBLIC_SOURCES).map((item) => ({
    title: item.title,
    url: item.url,
    // Google News links point at google.com; the publisher is what matters to a reader.
    publisher: item.publisher || publisherOf(item.url),
    sourceType: item.sourceType,
    stance: item.stance,
    noteEn: item.noteEn,
  }));

  const analysts = report.analysts ?? [];
  const reCheck = report.adjudicator ?? "no re-check recorded";
  const publishers = report.independentSources ?? 0;
  const flags = flagsFor({
    verdict: report.preliminaryVerdict,
    publishers,
    evidenceChecked: evidence.length,
    analysts,
    reCheck,
  });

  const answer: PublicAnswer = {
    id: `ask-${randomUUID()}`,
    claim: input.claim,
    language: input.language,
    verdict: report.preliminaryVerdict,
    confidence: report.confidence,
    headline: headlineFor(report.preliminaryVerdict, input.claim),
    supporting: report.supportingSummaryEn,
    contradicting: report.contradictingSummaryEn,
    missingContext: report.missingContextEn,
    sources,
    analysts: analysts.map((analyst) => ({
      provider: analyst.provider,
      model: analyst.model,
      verdict: analyst.preliminaryVerdict,
      confidence: analyst.confidence,
      agrees: analyst.agreesWithFinal,
    })),
    reCheck,
    publishers,
    evidenceChecked: evidence.length,
    sourcesUsed: report.sourcesUsed ?? [],
    durationMs: report.durationMs ?? 0,
    model: report.model ?? null,
    flags,
    createdAt: new Date().toISOString(),
    machine: true,
  };

  const db = adminDb();
  if (db) {
    try {
      await db
        .collection(COLLECTIONS.publicChecks)
        .doc(answer.id)
        .set({ ...answer, ipHash: input.ipHash });
    } catch (error) {
      console.error("[public-check] failed to record the answer", error);
    }
  } else {
    console.warn("[public-check] no database configured — answer not recorded for the desk");
  }

  return answer;
}

export interface PublicCheckSummary {
  id: string;
  claim: string;
  verdict: Verdict;
  confidence: string;
  publishers: number;
  evidenceChecked: number;
  flags: string[];
  model: string | null;
  durationMs: number;
  createdAt: string;
  analysts: PublicAnswer["analysts"];
  reCheck: string;
}

export async function listPublicChecks(limit = 100): Promise<PublicCheckSummary[]> {
  const db = adminDb();
  if (!db) return [];
  try {
    const snapshot = await db
      .collection(COLLECTIONS.publicChecks)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() as PublicCheckRecord;
      return {
        id: doc.id,
        claim: data.claim,
        verdict: data.verdict,
        confidence: data.confidence,
        publishers: data.publishers ?? 0,
        evidenceChecked: data.evidenceChecked ?? 0,
        flags: data.flags ?? [],
        model: data.model ?? null,
        durationMs: data.durationMs ?? 0,
        createdAt: data.createdAt,
        analysts: data.analysts ?? [],
        reCheck: data.reCheck ?? "",
      };
    });
  } catch (error) {
    console.error("[public-check] could not list answers", error);
    return [];
  }
}
