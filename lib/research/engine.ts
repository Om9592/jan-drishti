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

const NUMBER_WORDS = new Set(
  (
    "one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand " +
    "lakh lakhs crore crores million billion percent per cent"
  )
    .split(" ")
    .filter(Boolean),
);

const STOPWORDS = new Set(
  ("a an and are as at be been being by for from had has have he her his i in into is it its of on or our " +
    "said says she that the their them there these they this those to was were what when where which who why " +
    "will with would you your more than over under after before during also just only very much many some " +
    "news claim viral video viral post reportedly report reports according source sources")
    .split(" ")
    .filter(Boolean),
);

/**
 * Search engines (and RSS indexes) match keywords, not sentences. Passing the
 * full claim as a query — which is what the deterministic path used to do —
 * returned almost nothing on the live deployment. This builds a keyword query
 * from the longest content words plus any named entities.
 */
function keywordsOf(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
  const entities = Array.from(new Set((text.match(ENTITY_RE) ?? []).filter((e) => e.length > 3)));
  const ranked = Array.from(new Set(words)).sort((a, b) => b.length - a.length).slice(0, 8);
  const merged = Array.from(new Set([...entities.slice(0, 4), ...ranked])).slice(0, 10);
  return merged.join(" ");
}

/**
 * News indexes (Google News, Bing News) treat a multi-word query as AND, so a
 * five-word query returns almost nothing. Short queries of two or three terms
 * retrieve far more, so the deterministic path generates a spread of them:
 * proper-noun pairs first, then entity + distinctive noun, then a fact-check
 * specific query, then the full keyword string for indexes that tolerates it.
 */
function fallbackQueries(claimText: string): { claims: ResearchReport["extractedClaims"]; queries: string[]; entities: string[] } {
  const sentences = claimText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।])\s+/)
    .filter((s) => s.trim().length > 12)
    .slice(0, 4);
  // Sentence-initial capitals and number words are not entities: "More Yamuna"
  // is a worse query than "Yamuna fish".
  const entities = Array.from(
    new Set((claimText.match(ENTITY_RE) ?? []).map((word) => word.replace(/^(The|A|An)\s+/, ""))),
  )
    .filter((word) => word.length > 3)
    .filter((word) => {
      const lower = word.toLowerCase();
      return !STOPWORDS.has(lower) && !NUMBER_WORDS.has(lower) && !NUMBER_WORDS.has(lower.split(" ")[0]);
    })
    .slice(0, 10);
  const claims = sentences.map((text) => ({ text: text.trim(), type: "factual" as const, entities }));

  const contentWords = claimText
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()) && !NUMBER_WORDS.has(w.toLowerCase()));
  const distinctive = contentWords.filter((w) => !entities.some((e) => e.includes(w))).slice(0, 6);
  const keywords = keywordsOf(claimText) || contentWords.slice(0, 5).join(" ");

  const queries: string[] = [];
  if (entities.length >= 2) queries.push(`${entities[0]} ${entities[1]}`);
  if (entities.length >= 1 && distinctive.length >= 1) queries.push(`${entities[0]} ${distinctive[0]}`);
  // A quoted phrase from the claim finds the exact story rather than any page
  // that shares two common words.
  if (distinctive.length >= 2) queries.push(`"${distinctive[0]} ${distinctive[1]}"`);
  if (distinctive.length >= 2) queries.push(`${distinctive[0]} ${distinctive[1]}`);
  if (entities.length >= 1) queries.push(`${entities[0]} fact check`);
  if (queries.length === 0) queries.push(keywords);
  queries.push(keywords);

  return {
    claims: claims.length > 0 ? claims : [{ text: claimText.slice(0, 300), type: "factual", entities }],
    queries: Array.from(new Set(queries)).slice(0, 5),
    entities,
  };
}

/**
 * Models wrap JSON in code fences, add a sentence before it, or emit trailing
 * commentary. Pull the first JSON object out and parse that, instead of failing
 * the whole step on a stray backtick.
 */
function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      // fall through
    }
  }
  return null;
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

  let aiNotice: string | null = null;
  // The verdict is what the model is for. Extraction is optional, opt-in, and
  // skipped by default so a limited key still gets its one call.
  if (isAiConfigured() && config.ai.aiExtraction) {
    let extraction: { text: string; model: string } | null = null;
    try {
      extraction = await aiComplete(
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
        {
          json: true,
          temperature: 0,
          maxTokens: 1400,
          // Extraction is an accelerator, not a dependency: if the provider is
          // slow we keep the request fast and fall back to deterministic queries.
          timeoutMs: 30_000,
          retryOnTruncation: false,
        },
      );
    } catch (error) {
      aiNotice = (error as Error).message;
      console.error("[research] extraction failed:", aiNotice);
    }
    if (extraction) {
      try {
        const parsed = aiExtractionSchema.parse(parseJsonLoose(extraction.text));
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
      setStep(
        "extract",
        "unavailable",
        `AI extraction unavailable (${aiNotice ?? "no response"}); deterministic extraction used.`,
      );
      setStep("entities", "done");
      setStep("queries", "done");
    }
  } else {
    setStep(
      "extract",
      "done",
      isAiConfigured()
        ? "Deterministic extraction (model call reserved for the verdict; set RESEARCH_AI_EXTRACTION=1 to use AI here)."
        : "Deterministic extraction (no AI provider configured).",
    );
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

  // If the first pass is too thin to corroborate, retry once with a short
  // keyword query — long sentences retrieve poorly from news indexes.
  if (independentPublishers(hits).length < 3) {
    const keywordQuery = keywordsOf(input.claimText);
    if (keywordQuery) {
      const retry = await retrieveEvidence([keywordQuery], 10);
      for (const name of retry.used) sourcesUsed.add(`${name}-retry`);
      for (const hit of retry.hits) pushHit(hit);
    }
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
    let synthesis: { text: string; model: string } | null = null;
    try {
      synthesis = await aiComplete(
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
            "Keep it short: each summary at most 60 words, missingContext at most 60 words, at most 8 evidenceNotes, each note at most 20 words. Output must be one complete JSON object.",
          ].join(" "),
        },
        {
          role: "user",
          content: `CLAIM:\n${input.claimText}\n\nEXTRACTED CLAIMS:\n${claims.map((c, i) => `${i + 1}. ${c.text}`).join("\n")}\n\nINDEPENDENT PUBLISHERS (${independent.length}): ${independent.join(", ") || "none"}\nPRIMARY RECORDS: ${primaryCount}\n\nRETRIEVED EVIDENCE:\n${evidence
            .map((e, i) => `[${i + 1}] ${e.title}\nURL: ${e.url}\nType: ${e.sourceType}\nSnippet: ${e.quote}`)
            .join("\n\n")}`,
        },
      ],
        {
          json: true,
          temperature: 0.1,
          maxTokens: 2600,
          // The verdict is the point of the run, so this call waits much longer.
          timeoutMs: 120_000,
        },
      );
    } catch (error) {
      aiNotice = (error as Error).message;
      console.error("[research] synthesis failed:", aiNotice);
    }

    if (synthesis) {
      try {
        const parsed = aiSynthesisSchema.parse(parseJsonLoose(synthesis.text));
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
      } catch (parseError) {
        console.error(
          "[research] synthesis output rejected:",
          (parseError as Error).message.slice(0, 300),
          "| raw:",
          (synthesis.text ?? "").slice(0, 400),
        );
        setStep("compare", "unavailable", "Model output failed schema validation; no preliminary verdict generated.");
        setStep("context", "unavailable");
        setStep("draft", "done", "Evidence attached for manual review. No automatic recommendation.");
      }
    } else {
      setStep(
        "compare",
        "unavailable",
        `AI synthesis unavailable (${aiNotice ?? "no response"}). Evidence attached for manual review.`,
      );
      setStep("context", "unavailable");
      setStep("draft", "done", "Evidence attached for manual review. No automatic recommendation.");
    }
  } else if (evidence.length > 0 && aiNotice) {
    report.missingContextEn = [
      `The AI provider could not be used: ${aiNotice}`,
      "The evidence file below is complete and real; an editor must write the finding manually (or fix the model configuration and re-run).",
      report.missingContextEn,
    ]
      .filter(Boolean)
      .join("\n\n");
    setStep("compare", "unavailable", aiNotice);
    setStep("context", "unavailable");
    setStep("draft", "done", "Evidence attached for manual review. AI configuration needs attention.");
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
