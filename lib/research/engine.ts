import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config, isAiConfigured, isSearchConfigured } from "@/lib/config";
import { aiComplete, classifySource, webSearch, type SearchHit } from "@/lib/research/providers";
import { independentPublishers, retrieveEvidence } from "@/lib/research/keyless";
import type {
  Evidence,
  Language,
  ResearchReport,
  ResearchStep,
  SourceType,
  Verdict,
} from "@/lib/types";

/**
 * AI-assisted research engine.
 *
 * Design rules enforced here:
 *  - Machine output is always `preliminary: true` and can never set status
 *    to published. Only `publishFactCheck()` (human, role-gated) can.
 *  - Every evidence item must come from a configured provider. When no
 *    search provider exists, the pipeline reports `unavailable` steps and
 *    recommends UNVERIFIED — it never invents sources.
 *  - The recommended verdict is clamped to the allowed enum and is only a
 *    recommendation for the editor.
 */

const STEPS: Omit<ResearchStep, "status">[] = [
  { key: "extract", labelEn: "Extract factual claims", labelHi: "तथ्यात्मक दावे अलग करें" },
  { key: "entities", labelEn: "Identify people, places, dates", labelHi: "व्यक्ति, स्थान, तिथियाँ पहचानें" },
  { key: "queries", labelEn: "Generate research queries", labelHi: "शोध प्रश्न बनाएँ" },
  { key: "search", labelEn: "Retrieve evidence from configured sources", labelHi: "कॉन्फ़िगर स्रोतों से प्रमाण खोजें" },
  { key: "classify", labelEn: "Classify sources (primary / independent / social)", labelHi: "स्रोतों का वर्गीकरण" },
  {
    key: "corroborate",
    labelEn: "Count independent publishers (needs 3+)",
    labelHi: "स्वतंत्र प्रकाशकों की गणना (3+ आवश्यक)",
  },
  { key: "compare", labelEn: "Compare supporting and contradicting evidence", labelHi: "समर्थक व विरोधी प्रमाण तुलना" },
  { key: "context", labelEn: "Identify missing context", labelHi: "छूटे संदर्भ की पहचान" },
  { key: "draft", labelEn: "Draft preliminary report", labelHi: "प्रारंभिक रिपोर्ट तैयार करें" },
];

const ENTITY_RE = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3})\b/g;

function fallbackQueries(claimText: string): { claims: ResearchReport["extractedClaims"]; queries: string[]; entities: string[] } {
  const sentences = claimText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।])\s+/)
    .filter((s) => s.trim().length > 12)
    .slice(0, 4);
  const entities = Array.from(new Set(claimText.match(ENTITY_RE) ?? [])).slice(0, 10);
  const claims = sentences.map((text) => ({ text: text.trim(), type: "factual" as const, entities }));
  const core = claimText.replace(/\s+/g, " ").slice(0, 180);
  return {
    claims: claims.length > 0 ? claims : [{ text: claimText.slice(0, 300), type: "factual", entities }],
    queries: [
      `${core} official notification`,
      `${core} fact check`,
      `${core} PIB press release`,
    ],
    entities,
  };
}

const aiExtractionSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string(),
        type: z.enum(["factual", "opinion", "prediction"]).default("factual"),
        entities: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  entities: z.array(z.string()).default([]),
  queries: z.array(z.string()).default([]),
  primaryDocumentHint: z.string().optional(),
});

const aiSynthesisSchema = z.object({
  supportingSummaryEn: z.string().default(""),
  contradictingSummaryEn: z.string().default(""),
  missingContextEn: z.string().default(""),
  preliminaryVerdict: z
    .enum(["verified_true", "false", "misleading", "unverified", "outdated", "disputed"])
    .default("unverified"),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
  evidenceNotes: z
    .array(
      z.object({
        url: z.string(),
        stance: z.enum(["supports", "contradicts", "context"]).default("context"),
        noteEn: z.string().default(""),
      }),
    )
    .default([]),
});

export interface ResearchInput {
  claimId: string;
  claimText: string;
  language: Language;
  submissionId?: string | null;
  url?: string | null;
}

export interface ResearchResult {
  report: ResearchReport;
  evidence: Evidence[];
}

function emptyReport(claimId: string, steps: ResearchStep[]): ResearchReport {
  return {
    id: `research-${randomUUID()}`,
    claimId,
    generatedAt: new Date().toISOString(),
    aiConfigured: isAiConfigured(),
    searchConfigured: isSearchConfigured(),
    extractedClaims: [],
    queries: [],
    evidenceIds: [],
    supportingSummaryEn: "",
    contradictingSummaryEn: "",
    missingContextEn: "",
    preliminaryVerdict: "unverified",
    confidence: "low",
    steps,
    preliminary: true,
  };
}

export async function runResearch(input: ResearchInput): Promise<ResearchResult> {
  const steps: ResearchStep[] = STEPS.map((s) => ({ ...s, status: "pending" as const }));
  const setStep = (key: string, status: ResearchStep["status"], detail?: string) => {
    const step = steps.find((s) => s.key === key);
    if (step) {
      step.status = status;
      if (detail) step.detail = detail;
    }
  };

  // ---------------------------------------------------------------- 1. extract
  const fallback = fallbackQueries(input.claimText);
  let claims = fallback.claims;
  let queries = fallback.queries;
  let entities = fallback.entities;

  if (isAiConfigured()) {
    const extraction = await aiComplete(
      [
        {
          role: "system",
          content: [
            "You are a research assistant for an Indian fact-checking desk.",
            "Extract only checkable factual claims. Separate opinion and prediction from fact.",
            "Generate 3-5 precise search queries that would locate primary documents (gazette notifications, court orders, official data, PIB releases) and independent reporting.",
            "Return strict JSON: {\"claims\":[{\"text\":\"\",\"type\":\"factual|opinion|prediction\",\"entities\":[\"\"]}],\"entities\":[\"\"],\"queries\":[\"\"],\"primaryDocumentHint\":\"\"}",
            "Never assert whether the claim is true. Never invent sources.",
          ].join(" "),
        },
        { role: "user", content: `CLAIM (${input.language}):\n${input.claimText}\n\nCONTEXT URL: ${input.url ?? "none"}` },
      ],
      { json: true, temperature: 0, maxTokens: 900 },
    );
    if (extraction) {
      try {
        const parsed = aiExtractionSchema.parse(JSON.parse(extraction.text));
        if (parsed.claims.length > 0) claims = parsed.claims;
        if (parsed.queries.length > 0) queries = parsed.queries.slice(0, 6);
        if (parsed.entities.length > 0) entities = parsed.entities.slice(0, 12);
        setStep("extract", "done", `${claims.length} checkable claim(s) extracted.`);
        setStep("entities", "done", entities.slice(0, 6).join(", ") || "No named entities identified.");
        setStep("queries", "done", `${queries.length} queries generated.`);
      } catch {
        setStep("extract", "done", "Structured extraction failed validation; used deterministic extraction.");
        setStep("entities", "done");
        setStep("queries", "done");
      }
    } else {
      setStep("extract", "unavailable", "AI provider did not respond; deterministic extraction used.");
      setStep("entities", "done");
      setStep("queries", "done");
    }
  } else {
    setStep("extract", "done", "Deterministic extraction (no AI provider configured).");
    setStep("entities", "done", `${entities.length} possible entity name(s).`);
    setStep("queries", "done", "Queries generated from claim text.");
  }

  // ---------------------------------------------------------------- 2. search
  //
  // Evidence gathering always runs. Paid search keys are used when present,
  // and the keyless retrievers (Google News RSS, Bing News RSS, the trusted
  // wire, Wikipedia) fill in — or carry the whole load — when they are not.
  const startedAt = Date.now();
  const querySet = queries.slice(0, 4);

  const keyless = await retrieveEvidence(querySet, 8);

  const hits: SearchHit[] = [];
  const seenUrls = new Set<string>();
  const sourcesUsed = new Set<string>(keyless.used);
  const pushHit = (hit: SearchHit) => {
    const key = hit.url.split("?")[0].toLowerCase();
    if (!key || seenUrls.has(key)) return;
    seenUrls.add(key);
    hits.push(hit);
  };

  if (isSearchConfigured()) {
    for (const query of querySet) {
      const results = await webSearch(query, 5);
      if (results.length > 0) sourcesUsed.add("paid-search");
      for (const hit of results) pushHit(hit);
    }
  }
  for (const hit of keyless.hits) pushHit(hit);

  const searchMode: ResearchReport["searchMode"] =
    hits.length === 0 ? "none" : isSearchConfigured() ? "both" : "keyless";

  if (hits.length === 0) {
    setStep(
      "search",
      "unavailable",
      "No retriever returned a result (Google News RSS, Bing News RSS, trusted wire, Wikipedia" +
        (isSearchConfigured() ? ", paid search" : "") +
        "). No evidence was retrieved.",
    );
    setStep("classify", "unavailable");
    setStep("corroborate", "unavailable");
    setStep("compare", "unavailable");
    setStep("context", "unavailable");
    setStep("draft", "done", "Draft states that no evidence could be retrieved. Recommended verdict: UNVERIFIED.");
    const report = emptyReport(input.claimId, steps);
    report.extractedClaims = claims;
    report.queries = queries;
    report.sourcesUsed = Array.from(sourcesUsed);
    report.independentSources = 0;
    report.searchMode = "none";
    report.durationMs = Date.now() - startedAt;
    report.missingContextEn =
      "The research pipeline ran but no retriever returned a usable result, so no external evidence was collected. This report is not a finding: it records that the evidence step could not be performed.";
    report.preliminaryVerdict = "unverified";
    return { report, evidence: [] };
  }

  const publishers = independentPublishers(hits);
  setStep(
    "search",
    "done",
    `${hits.length} unique result(s) from ${publishers.length} publisher(s) via ${Array.from(sourcesUsed)
      .map((name) => name.replace(/-/g, " "))
      .join(", ")}.`,
  );

  const evidence: Evidence[] = hits.slice(0, 16).map((hit) => ({
    id: `ev-${randomUUID()}`,
    claimId: input.claimId,
    title: hit.title,
    url: hit.url,
    publisher: hit.publisher ?? safeHost(hit.url),
    publishedAt: hit.publishedAt ?? null,
    retrievedAt: new Date().toISOString(),
    sourceType: (hit.sourceType ?? classifySource(hit.url)) as SourceType,
    stance: "context",
    quote: hit.snippet.slice(0, 400),
    relevance: 0.5,
  }));

  setStep("classify", "done", `${evidence.filter((e) => ["government", "primary_record"].includes(e.sourceType)).length} primary / official record(s) in the set.`);

  // ------------------------------------------------------- 2b. corroborate
  const independent = independentPublishers(evidence);
  const primaryCount = evidence.filter((e) => ["government", "primary_record"].includes(e.sourceType)).length;
  const MIN_INDEPENDENT = 3;
  const corroborated = independent.length >= MIN_INDEPENDENT || primaryCount >= 1;
  setStep(
    "corroborate",
    corroborated ? "done" : "unavailable",
    corroborated
      ? `${independent.length} independent publisher(s)${primaryCount > 0 ? ` and ${primaryCount} primary record(s)` : ""} — above the ${MIN_INDEPENDENT}-source floor.`
      : `Only ${independent.length} independent publisher(s) — below the ${MIN_INDEPENDENT}-source floor, so no verdict stronger than UNVERIFIED can be recommended.`,
  );

  // ---------------------------------------------------------------- 3. synthesise
  let report = emptyReport(input.claimId, steps);
  report.extractedClaims = claims;
  report.queries = queries;
  report.evidenceIds = evidence.map((e) => e.id);

  report.sourcesUsed = Array.from(sourcesUsed);
  report.independentSources = independent.length;
  report.searchMode = searchMode;

  if (isAiConfigured() && evidence.length > 0) {
    const synthesis = await aiComplete(
      [
        {
          role: "system",
          content: [
            "You are assisting a human fact-checking editor in India. You are given numbered search results only — you may not use any other knowledge and may not invent sources.",
            "Assess what the retrieved evidence supports, what it contradicts, and what context is missing.",
            "Recommend a preliminary verdict from: verified_true, false, misleading, unverified, outdated, disputed.",
            "If evidence is thin, indirect, or does not address the specific claim, choose unverified with low confidence.",
            "Corroboration rule: a verdict of verified_true or false requires at least three INDEPENDENT publishers agreeing, or one primary government/court record. If the evidence set has fewer, you must return unverified or disputed and say why.",
            "Treat syndicated copies of one wire story as a single source, not several.",
            "Return strict JSON: {\"supportingSummaryEn\":\"\",\"contradictingSummaryEn\":\"\",\"missingContextEn\":\"\",\"preliminaryVerdict\":\"unverified\",\"confidence\":\"low\",\"evidenceNotes\":[{\"url\":\"\",\"stance\":\"supports|contradicts|context\",\"noteEn\":\"\"}]}",
            "Write in plain English for an editor. No verdict is final; a human decides.",
          ].join(" "),
        },
        {
          role: "user",
          content: `CLAIM:\n${input.claimText}\n\nEXTRACTED CLAIMS:\n${claims.map((c, i) => `${i + 1}. ${c.text}`).join("\n")}\n\nINDEPENDENT PUBLISHERS (${independent.length}): ${independent.join(", ") || "none"}\nPRIMARY RECORDS: ${primaryCount}\n\nRETRIEVED EVIDENCE:\n${evidence
            .map((e, i) => `[${i + 1}] ${e.title}\nURL: ${e.url}\nType: ${e.sourceType}\nSnippet: ${e.quote}`)
            .join("\n\n")}`,
        },
      ],
      { json: true, temperature: 0.1, maxTokens: 1600 },
    );

    if (synthesis) {
      try {
        const parsed = aiSynthesisSchema.parse(JSON.parse(synthesis.text));
        report = {
          ...report,
          model: synthesis.model,
          supportingSummaryEn: parsed.supportingSummaryEn,
          contradictingSummaryEn: parsed.contradictingSummaryEn,
          missingContextEn: parsed.missingContextEn,
          preliminaryVerdict: parsed.preliminaryVerdict as Verdict,
          confidence: parsed.confidence,
        };
        for (const note of parsed.evidenceNotes) {
          const match = evidence.find((e) => e.url === note.url);
          if (match) {
            match.stance = note.stance;
            match.noteEn = note.noteEn;
          }
        }
        const strong = parsed.preliminaryVerdict === "verified_true" || parsed.preliminaryVerdict === "false";
        if (strong && !corroborated) {
          report.preliminaryVerdict = "unverified";
          report.confidence = "low";
          report.missingContextEn = [
            report.missingContextEn,
            `Corroboration floor not met: ${independent.length} independent publisher(s) (${MIN_INDEPENDENT} required, or one primary record). The model suggested ${parsed.preliminaryVerdict}; it has been downgraded to UNVERIFIED.`,
          ]
            .filter(Boolean)
            .join("\n\n");
          setStep("corroborate", "unavailable", "Model's verdict downgraded — evidence set is not independent enough to support it.");
        }
        setStep("compare", "done", "Supporting and contradicting evidence compared by model; editor must verify each item.");
        setStep("context", "done");
        setStep("draft", "done", `Preliminary recommendation: ${parsed.preliminaryVerdict} (${parsed.confidence} confidence).`);
      } catch {
        setStep("compare", "unavailable", "Model output failed schema validation; no preliminary verdict generated.");
        setStep("context", "unavailable");
        setStep("draft", "done", "Evidence attached for manual review. No automatic recommendation.");
      }
    } else {
      setStep("compare", "unavailable", "AI provider did not respond. Evidence attached for manual review.");
      setStep("context", "unavailable");
      setStep("draft", "done", "Evidence attached for manual review. No automatic recommendation.");
    }
  } else if (evidence.length > 0) {
    report.missingContextEn =
      "Evidence was retrieved but no AI provider is configured to compare it. An editor must assess the items manually.";
    setStep("compare", "unavailable", "Requires AI provider or manual editorial analysis.");
    setStep("context", "unavailable");
    setStep("draft", "done", "Evidence list prepared for manual review.");
  }

  report.durationMs = Date.now() - startedAt;
  return { report, evidence };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Unknown publisher";
  }
}

export function researchCapabilities() {
  return {
    ai: isAiConfigured(),
    search: isSearchConfigured(),
    /** Always true: the keyless retrievers need no credentials. */
    evidence: true,
    model: isAiConfigured() ? config.ai.model : null,
    provider: isAiConfigured() ? config.ai.provider : null,
    /** What the desk would need to add for full AI synthesis. */
    needs: isAiConfigured()
      ? []
      : ["AI_API_KEY (AI_PROVIDER=gemini|groq|openai|openrouter|deepseek — any one key works)"],
  };
}
