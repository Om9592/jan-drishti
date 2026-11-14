import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config, isAiConfigured, isSearchConfigured } from "@/lib/config";
import { aiComplete, aiFanout, classifySource, webSearch, type SearchHit } from "@/lib/research/providers";
import { independentPublishers, retrieveEvidence } from "@/lib/research/keyless";
import type {
  AnalystAssessment,
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

const ENTITY_RE = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3}|[A-Z]{2,6})\b/g;

const NUMBER_WORDS = new Set(
  (
    "one two three four five six seven eight nine ten eleven twelve twenty thirty forty fifty hundred thousand " +
    "lakh lakhs crore crores million billion percent per cent"
  )
    .split(" ")
    .filter(Boolean),
);

/**
 * Question words and hedging are the single biggest retrieval trap: "Is it true
 * that the RBI has withdrawn 500-rupee notes?" used to produce the queries
 * "true withdrawn" and fetched stories about US bombers and church attendance.
 * A claim is searched by its subjects and figures, so filler is dropped here.
 */
const STOPWORDS = new Set(
  ("a an and are as at be been being by for from had has have he her his i in into is it its of on or our " +
    "said says she that the their them there these they this those to was were what when where which who why " +
    "will with would you your more than over under after before during also just only very much many some " +
    "did does do done doing make made makes made get got give given take taken said told ask asked " +
    "am are was were be been being having had having can could should may might must shall ought " +
    "here there then them they these those this that which what when where who whom whose why how " +
    "government govt govt sarkar official officials ministry minister report reports year years today " +
    "people person video viral post claim claims news story stories india indian state states country " +
    "news claim claims claimed viral video videos post reportedly report reports according source sources " +
    "true false real fake hoax rumour rumor fact check checking ask question tell know think really actually " +
    "please sir madam yes no not dont doesn didn cant cannot could should must may might shall " +
    "kya hai hain ki ka ke ko mein me se par aur bhi nahi nahin sach sachi jhooth khabar bataye batao " +
    "yeh ye woh wo iska usko ise use kuch koi logon log")
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
    // Three letters is the whole point: RBI, CBI, WHO, NIA, ED. The old >3 rule
    // threw away every acronym and left the gate blind.
    .filter((word) => word.length >= 3 || word.length === 0)
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
  const distinctive = Array.from(new Set(contentWords.filter((w) => !entities.some((e) => e.includes(w))))).slice(
    0,
    6,
  );
  const keywords = keywordsOf(claimText) || contentWords.slice(0, 5).join(" ");

  // Figures anchor a claim: "500" with "rupee" finds the note story, while the
  // same words without it find every story about money.
  const numbers = Array.from(new Set((claimText.match(/\b\d{2,6}\b/g) ?? []).slice(0, 3)));

  const queries: string[] = [];
  const anchor = entities[0] ?? "";
  if (anchor && numbers.length > 0) queries.push(`${anchor} ${numbers[0]}`);
  if (anchor && distinctive.length >= 2) queries.push(`${anchor} ${distinctive[0]} ${distinctive[1]}`);
  if (anchor && distinctive.length >= 1) queries.push(`${anchor} ${distinctive[0]}`);
  if (distinctive.length >= 2) queries.push(`"${distinctive[0]} ${distinctive[1]}"`);
  if (distinctive.length >= 3) queries.push(`${distinctive[0]} ${distinctive[1]} ${distinctive[2]}`);
  if (entities.length >= 2) queries.push(`${entities[0]} ${entities[1]}`);
  if (anchor) queries.push(`${anchor} fact check`);
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

const VERDICTS = ["verified_true", "false", "misleading", "unverified", "outdated", "disputed"] as const;
const STANCES = ["supports", "contradicts", "context"] as const;

/**
 * Small models drift on enum values and invent stances ("other", "neutral").
 * Repair what is repairable before throwing away a whole model's assessment —
 * the summaries are the valuable part, the notes are decoration.
 */
function parseAssessment(text: string): z.infer<typeof aiSynthesisSchema> | null {
  const raw = parseJsonLoose(text);
  const strict = aiSynthesisSchema.safeParse(raw);
  if (strict.success) return strict.data;
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const verdict = VERDICTS.includes(source.preliminaryVerdict as (typeof VERDICTS)[number])
    ? (source.preliminaryVerdict as (typeof VERDICTS)[number])
    : "unverified";
  const confidence = ["low", "medium", "high"].includes(source.confidence as string)
    ? (source.confidence as "low" | "medium" | "high")
    : "low";
  const notes = Array.isArray(source.evidenceNotes)
    ? source.evidenceNotes
        .map((note) => {
          const entry = (note ?? {}) as Record<string, unknown>;
          const stance = STANCES.includes(entry.stance as (typeof STANCES)[number])
            ? (entry.stance as (typeof STANCES)[number])
            : "context";
          return { url: String(entry.url ?? ""), stance, noteEn: String(entry.noteEn ?? "") };
        })
        .filter((note) => note.url && note.noteEn)
    : [];
  const repaired = aiSynthesisSchema.safeParse({
    supportingSummaryEn: String(source.supportingSummaryEn ?? ""),
    contradictingSummaryEn: String(source.contradictingSummaryEn ?? ""),
    missingContextEn: String(source.missingContextEn ?? ""),
    preliminaryVerdict: verdict,
    confidence,
    evidenceNotes: notes,
  });
  return repaired.success ? repaired.data : null;
}

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
  /**
   * Wall-clock ceiling for the assessment stage. A reader waiting in a chat
   * window cannot sit through three free-tier rate-limit retries, so when the
   * budget runs out the run records exactly what it skipped and why, rather
   * than dropping the answer or pretending the check was complete.
   */
  budgetMs?: number;
  /** Strongest N evidence items to put in front of the models. */
  evidenceLimit?: number;
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
  const deadline = input.budgetMs ? Date.now() + input.budgetMs : Number.POSITIVE_INFINITY;
  const remaining = () => deadline - Date.now();
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

  /**
   * A claim typed in Hindi or Hinglish cannot be searched: Google News and Bing
   * match English keywords, so "Yamuna zehrile jhaag" returns nothing while
   * "Yamuna toxic foam" returns the story. One tiny call turns the claim into
   * English search terms; if it fails, the deterministic queries still run.
   */
  const devanagari = /[\u0900-\u097F]/.test(input.claimText);
  const hinglish = /\b(kya|hai|hain|nahi|nahin|mein|sach|jhooth|ka|ki|ke|ko|bataye|batao|khabar)\b/i.test(
    input.claimText,
  );
  if (isAiConfigured() && (devanagari || hinglish)) {
    try {
      const translateMessages = [
        {
          role: "system" as const,
          content:
            "Translate the claim into English search queries for a news index. Reply with up to 3 queries, one per line, each 2-6 words, no numbering, no quotes, no commentary.",
        },
        { role: "user" as const, content: input.claimText.slice(0, 500) },
      ];
      let translated = null as Awaited<ReturnType<typeof aiComplete>>;
      try {
        translated = await aiComplete(translateMessages, { temperature: 0, maxTokens: 120, timeoutMs: 8_000 });
      } catch (primaryError) {
        /**
         * A Hindi or Hinglish claim cannot be searched without English terms, and
         * this prompt is a single sentence — cheap enough for the keyless model
         * even when every keyed provider is exhausted.
         */
        const keyless = config.ai.chain.find((endpoint) => endpoint.keyless);
        console.warn("[research] translation retry on the keyless model:", (primaryError as Error).message);
        if (keyless) {
          translated = await aiComplete(translateMessages, {
            prefer: keyless.name,
            temperature: 0,
            maxTokens: 120,
            timeoutMs: 25_000,
          });
        }
      }
      const english = (translated?.text ?? "")
        .split("\n")
        .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
        .filter((line) => line.length >= 6 && /[a-z]/i.test(line))
        .slice(0, 3);
      if (english.length > 0) {
        queries = [...english, ...queries].slice(0, 6);
        console.log("[research] translated queries for retrieval:", english.join(" | "));
      }
    } catch (error) {
      console.warn("[research] could not translate the claim for search", (error as Error).message);
    }
  }

  // ---------------------------------------------------------------- 2. search
  //
  // Evidence gathering always runs. Paid search keys are used when present,
  // and the keyless retrievers (Google News RSS, Bing News RSS, the trusted
  // wire, Wikipedia) fill in — or carry the whole load — when they are not.
  const startedAt = Date.now();
  const querySet = queries.slice(0, 4);

  let keyless = await retrieveEvidence(querySet, 8);

  /**
   * A phrasing the index does not carry ("Buddha relics in Namsai") returns
   * nothing at all. Before telling the reader the search failed, try the two
   * words that carry the claim: a place and a thing.
   */
  if (keyless.hits.length === 0) {
    const bare = Array.from(
      new Set(
        (input.claimText.toLowerCase().match(/[a-z\u0900-\u097F][a-z\u0900-\u097F'-]{3,}/g) ?? []).filter(
          (word) => !/^(kya|sach|hai|hain|nahi|mein|that|this|with|from|have|has|been|about|claim|news|true|false|said|will)\b/.test(word),
        ),
      ),
    ).slice(0, 3);
    if (bare.length >= 2) {
      console.warn(`[research] nothing for the first queries; retrying with "${bare.join(" ")}"`);
      keyless = await retrieveEvidence([bare.join(" "), bare.slice(0, 2).join(" ")], 8, null);
    }
  }

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

  // ------------------------------------------------------- 2a. relevance gate
  // News indexes happily return a fresh story about something else entirely, and
  // the models will faithfully judge that junk. A hit is kept only if its title
  // or snippet shares a real token with the claim — an entity, a figure, or a
  // subject word. Official records and primary documents always survive: they
  // are the ones that can settle a claim even with sparse wording.
  const claimTokens = new Set(
    [
      ...(input.claimText.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []),
      ...((input.claimText.match(/\b\d{2,6}\b/g) ?? []).map((n) => n.toLowerCase())),
    ].filter((token) => !STOPWORDS.has(token)),
  );
  const claimNumbers = new Set(input.claimText.match(/\b\d{2,6}\b/g) ?? []);
  const claimEntities = entities
    .map((entity) => entity.toLowerCase())
    .filter((entity) => entity.length >= 3 || /^[a-z]{2,6}$/.test(entity));

  // The subject words of the claim, so "RBI" alone is not enough to make a story
  // about Paytm's wallet licence into evidence about ₹500 notes.
  const claimSubjects = Array.from(claimTokens).filter(
    (token) => !claimEntities.some((entity) => entity.includes(token) || token.includes(entity)),
  );

  const matchDetail = (hit: { title: string; snippet: string; url: string }) => {
    const text = `${hit.title} ${hit.snippet}`.toLowerCase();
    const matched = new Set<string>();
    for (const token of claimTokens) {
      if (text.includes(token)) matched.add(token);
    }
    const entityMatch = claimEntities.some((entity) => text.includes(entity));
    const numberMatch = Array.from(claimNumbers).some((number) => text.includes(number));
    const subjectMatch = claimSubjects.some((token) => text.includes(token));
    return { matched: [...matched], entityMatch, numberMatch, subjectMatch };
  };

  /**
   * One shared word is not a match. "Printing" appears in the RBI claim and in a
   * story about 3D printers; keeping that story makes the models reason about
   * the wrong subject with full confidence. A hit has to share the claim's
   * subject (an entity), one of its figures, or at least two of its content
   * words before it is treated as evidence about this claim.
   */
  const offTopic: string[] = [];
  const specificity = new Map<string, number>();
  const keepRelevant = (candidates: SearchHit[]) => candidates.filter((hit) => {
    const type = hit.sourceType ?? classifySource(hit.url);
    if (["government", "primary_record"].includes(type)) return true;
    const { matched, entityMatch, numberMatch, subjectMatch } = matchDetail(hit);
    specificity.set(
      hit.url,
      (entityMatch ? 3 : 0) + (numberMatch ? 3 : 0) + Math.min(3, matched.length) + (subjectMatch ? 1 : 0),
    );
    /**
     * The named organisation is the floor, not the answer. "RBI" appears in every
     * banking story, so a page about a wallet licence would otherwise count as
     * evidence about ₹500 notes being discontinued. The document has to mention
     * the claim's subject or one of its figures as well.
     */
    if (claimEntities.length > 0) {
      if (entityMatch && (subjectMatch || numberMatch)) return true;
    } else if (numberMatch || matched.length >= 2) {
      return true;
    }
    offTopic.push(hit.title.slice(0, 80));
    return false;
  });

  let relevant = keepRelevant(hits);

  /**
   * The recent window is right for a claim about today and wrong for a claim
   * about last month: "RBI stopped printing ₹500 notes" has no report from this
   * week, so a seven-day search returns only unrelated banking news. When the
   * fresh pass cannot carry the verdict, search again without the window and
   * apply the same subject test.
   */
  if (relevant.length < 4) {
    const widened = await retrieveEvidence(querySet, 8, null);
    if (widened.used.length > 0) sourcesUsed.add("widened-window");
    const before = new Set(hits.map((hit) => hit.url.split("?")[0].toLowerCase()));
    const added = widened.hits.filter((hit) => !before.has(hit.url.split("?")[0].toLowerCase()));
    console.warn(
      `[research] widened window added ${added.length} hit(s): ${added
        .slice(0, 3)
        .map((hit) => hit.title.slice(0, 40))
        .join(" | ")}`,
    );
    if (added.length > 0) {
      hits.push(...added);
      relevant = keepRelevant(hits);
    }
  }

  // Dropping everything would be its own kind of lie; keep the top-scoring hits
  // and let the report say the match was weak.
  if (relevant.length < 4) {
    // Rescue only what shares the claim's own subject. A short honest evidence
    // set beats a long one padded with stories about 3D printers.
    const rescued = hits
      .map((hit) => {
        const detail = matchDetail(hit);
        return {
          hit,
          score: detail.matched.length + (detail.entityMatch ? 4 : 0) + (detail.numberMatch ? 4 : 0),
          specific:
            claimEntities.length > 0
              ? detail.entityMatch && (detail.subjectMatch || detail.numberMatch)
              : true,
        };
      })
      .filter((entry) => entry.score > 0 && entry.specific)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((entry) => entry.hit);
    for (const hit of rescued) {
      if (!relevant.includes(hit)) relevant.push(hit);
    }
  }
  if (offTopic.length > 0) {
    console.warn(`[research] dropped ${offTopic.length} off-topic result(s):`, offTopic.slice(0, 3).join(" | "));
    const dropped = hits.filter((hit) => !relevant.includes(hit));
    hits.length = 0;
    hits.push(...relevant);
    /**
     * An empty evidence set reads to the reader as "the check did not run",
     * which is worse than "the closest reporting I could find is this". Keep the
     * best few loose matches, and let the thin-sourcing flag say the match is
     * weak.
     */
    if (relevant.length === 0 && dropped.length > 0) {
      dropped.sort((a, b) => (specificity.get(b.url) ?? 0) - (specificity.get(a.url) ?? 0));
      hits.push(...dropped.slice(0, 3));
      console.warn("[research] no exact match; keeping the 3 closest items so the answer can show what it read");
    }
  }

  // Order matters more than filtering: the prompt only carries the strongest ten
  // items, and the reader sees the same order. An item that names the claim's
  // subject, its figure, and its subject words belongs at the top; a story that
  // merely shares the organisation name belongs at the bottom.
  hits.sort((a, b) => {
    const diff = (specificity.get(b.url) ?? 0) - (specificity.get(a.url) ?? 0);
    if (diff !== 0) return diff;
    return Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0");
  });

  // Freshness: a claim asked today should not be settled by a three-year-old
  // explainer — but a claim that has been circulating for a year is settled by
  // the fact-checks written about it, so the guillotine has to sit far enough
  // back to keep those. Staleness is reported, not silently deleted.
  const now = Date.now();
  const dayMs = 86_400_000;
  const ageDays = (hit: { publishedAt?: string | null }) =>
    hit.publishedAt ? (now - Date.parse(hit.publishedAt)) / dayMs : Number.NaN;
  const freshEnough = hits.filter((hit) => {
    const type = hit.sourceType ?? classifySource(hit.url);
    if (["government", "primary_record"].includes(type)) return true;
    const age = ageDays(hit);
    return Number.isNaN(age) || age <= 400;
  });
  if (freshEnough.length > 0 && freshEnough.length !== hits.length) {
    console.warn(`[research] dropped ${hits.length - freshEnough.length} item(s) older than 400 days`);
    hits.length = 0;
    hits.push(...freshEnough);
  }
  const ages = hits.map(ageDays).filter((age) => Number.isFinite(age));
  const newestAge = ages.length > 0 ? Math.min(...ages) : Number.NaN;

  const publishers = independentPublishers(hits);
  setStep(
    "search",
    "done",
    `${hits.length} relevant result(s) from ${publishers.length} publisher(s) via ${Array.from(sourcesUsed)
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
  report.newestSourceAt =
    hits
      .map((hit) => hit.publishedAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  report.sourcesLast7Days = hits.filter((hit) => {
    const age = ageDays(hit);
    return Number.isFinite(age) && age <= 7;
  }).length;

  if (isAiConfigured() && evidence.length > 0) {
    /**
     * Free tiers meter tokens per minute (Groq allows 7-8k), and a 26-item dump
     * blows through that. The analysts get the strongest items with tight
     * snippets — enough to judge, small enough to answer — plus an even tighter
     * rendering for providers that still say "request too large".
     */
    const ranked = evidence
      .slice()
      .sort((a, b) => {
        const rank = (item: Evidence) =>
          item.sourceType === "primary_record"
            ? 0
            : item.sourceType === "government"
              ? 1
              : item.sourceType === "independent_journalism"
                ? 2
                : 3;
        return rank(a) - rank(b);
      });

    const renderEvidence = (items: Evidence[], snippetChars: number) =>
      items
        .map(
          (e, i) =>
            `[${i + 1}] ${e.title.slice(0, 140)}\nURL: ${e.url}\nType: ${e.sourceType}\nSnippet: ${(e.quote ?? "").slice(0, snippetChars)}`,
        )
        .join("\n\n");

    const promptEvidence = ranked.slice(0, Math.max(4, Math.min(10, input.evidenceLimit ?? 10)));
    const renderClaimBlock = (items: Evidence[], snippetChars: number) =>
      `CLAIM:\n${input.claimText}\n\nEXTRACTED CLAIMS:\n${claims
        .map((c, i) => `${i + 1}. ${c.text}`)
        .join("\n")}\n\nINDEPENDENT PUBLISHERS (${independent.length}): ${independent.join(", ") || "none"}\nPRIMARY RECORDS: ${primaryCount}\n\nRETRIEVED EVIDENCE (${items.length} of ${evidence.length} items):\n${renderEvidence(items, snippetChars)}`;

    const freshness =
      Number.isFinite(newestAge)
        ? `TODAY: ${new Date().toISOString().slice(0, 10)}. NEWEST SOURCE: ${
            newestAge < 1 ? "within the last day" : `${Math.round(newestAge)} day(s) ago`
          }. ITEMS FROM THE LAST 7 DAYS: ${hits.filter((hit) => {
            const age = ageDays(hit);
            return Number.isFinite(age) && age <= 7;
          }).length}.`
        : `TODAY: ${new Date().toISOString().slice(0, 10)}. No publication dates were available.`;
    /** Counting publishers is the engine's job, not the model's. */
    const corroboration =
      independent.length >= 3
        ? `CORROBORATION: ${independent.length} independent publishers are represented below, and the corroboration bar of three is therefore met if at least three of them report the same fact. They will use different wording and different angles — a political reaction, a data report, a wire copy — and that still counts as agreement about the underlying fact. Do not return unverified on the ground that corroboration is absent while this line says it is met.`
        : `CORROBORATION: only ${independent.length} independent publisher(s) below, so the three-publisher bar is not met; say so if you withhold a verdict.`;
    const evidenceBlock = `${freshness}\n${corroboration}\n\n${renderClaimBlock(promptEvidence, 300)}`;
    const compactBlock = renderClaimBlock(ranked.slice(0, 6), 180);

    const RULES = [
      "You are assisting a human fact-checking editor in India. You are given numbered search results only — you may not use any other knowledge and may not invent sources.",
      "Assess what the retrieved evidence supports, what it contradicts, and what context is missing.",
      "Recommend a preliminary verdict from: verified_true, false, misleading, unverified, outdated, disputed.",
      "If evidence is thin, indirect, or does not address the specific claim, choose unverified with low confidence.",
      "Decide from what is in front of you. When several independent publishers report the same event, in the same terms as the claim, that is verified_true — do not withhold a verdict just because you cannot open the articles themselves.",
      "Only choose unverified when the retrieved reports genuinely do not speak to the claim, not because the wording differs slightly.",
      "Corroboration rule: a verdict of verified_true or false requires at least three INDEPENDENT publishers agreeing, or one primary government/court record. The CORROBORATION line tells you whether that bar is met — trust it over your own count of the numbered items.",
      "If the documented event is real but the claim overstates it — a stretch of river described as the whole river, a local report described as a national order — return misleading and say exactly what is exaggerated, rather than unverified.",
      "Treat syndicated copies of one wire story as a single source, not several.",
    ];
    const SCHEMA =
      'Return strict JSON: {"supportingSummaryEn":"","contradictingSummaryEn":"","missingContextEn":"","preliminaryVerdict":"unverified","confidence":"low","evidenceNotes":[{"url":"","stance":"supports|contradicts|context","noteEn":""}]}';
    const BREVITY =
      "Write in plain English for an editor. No verdict is final; a human decides. Keep each summary at most 60 words, at most 8 evidenceNotes of at most 20 words. Output must be one complete JSON object.";

    // ------------------------------------------------ 1. independent analysts
    // Each model judges the SAME evidence set on its own and never sees the
    // others' answers, so agreement between them is worth something.
    const analystSystem = [
      ...RULES,
      "You are one of several independent analysts. Judge this evidence yourself; you will not see the other analysts' answers.",
      SCHEMA,
      BREVITY,
    ].join(" ");

    let fanout: Awaited<ReturnType<typeof aiFanout>> = [];
    // Retrieval and translation have already spent part of the budget; the model
    // pass gets the rest, capped so a single slow provider cannot own it.
    const analystBudget = Math.min(90_000, remaining(), 40_000);
    if (analystBudget < 15_000) {
      aiNotice = "the model pass was skipped to keep the wait short";
      console.warn("[research] no time left for analysts:", analystBudget, "ms");
    } else try {
      fanout = await aiFanout(
        [
          { role: "system", content: analystSystem },
          { role: "user", content: evidenceBlock },
        ],
        {
          json: true,
          temperature: 0.1,
          maxTokens: 1800,
          timeoutMs: analystBudget,
          deadline: Number.isFinite(deadline) ? deadline : undefined,
          onTokenLimit: [
            { role: "system", content: analystSystem },
            { role: "user", content: compactBlock },
          ],
          onTokenLimitMaxTokens: 900,
        },
      );
    } catch (error) {
      aiNotice = (error as Error).message;
      console.error("[research] analyst pass failed:", aiNotice);
    }

    /**
     * Nobody answered. The keyless community model is slow and reasoning-heavy,
     * so it is kept off the fan-out — but a verdict from it, on the same evidence
     * with a shorter prompt, is worth more to the reader than no verdict at all.
     */
    if (fanout.every((result) => !result.answer)) {
      const keyless = config.ai.chain.find((endpoint) => endpoint.keyless);
      const left = remaining();
      if (keyless && left > 12_000) {
        try {
          const solo = await aiComplete(
            [
              { role: "system", content: analystSystem },
              {
                role: "user",
                content: `${compactBlock}\nAnswer with JSON only, in the schema given. Be decisive when several publishers report the same thing.`,
              },
            ],
            {
              prefer: keyless.name,
              json: true,
              temperature: 0.1,
              maxTokens: 900,
              timeoutMs: Math.min(left - 6_000, 60_000),
            },
          );
          if (solo) {
            fanout = [{ provider: solo.provider, label: solo.provider, answer: solo, error: undefined }];
            console.warn(`[research] keyless rescue answered in ${Date.now() - startedAt}ms`);
          }
        } catch (error) {
          console.warn("[research] keyless rescue failed:", (error as Error).message);
        }
      }
    }

    const assessments: AnalystAssessment[] = [];
    for (const result of fanout) {
      if (!result.answer) {
        console.warn(`[research] analyst ${result.provider} unavailable: ${result.error}`);
        continue;
      }
      try {
        const parsed = parseAssessment(result.answer.text);
        if (!parsed) throw new Error("output did not match the assessment shape");
        assessments.push({
          provider: result.provider,
          model: result.answer.model,
          preliminaryVerdict: parsed.preliminaryVerdict as Verdict,
          confidence: parsed.confidence,
          supportingSummaryEn: parsed.supportingSummaryEn,
          contradictingSummaryEn: parsed.contradictingSummaryEn,
          missingContextEn: parsed.missingContextEn,
          agreesWithFinal: true,
        });
      } catch (error) {
        console.error(
          `[research] analyst ${result.provider} output rejected:`,
          (error as Error).message.slice(0, 200),
          "| raw:",
          result.answer.text.slice(0, 300),
        );
      }
    }

    if (assessments.length === 0) {
      const why =
        fanout.map((result) => `${result.provider}: ${result.error ?? "unusable output"}`).join("; ") ||
        aiNotice ||
        "no provider answered";
      setStep("compare", "unavailable", `No model produced a usable assessment (${why}). Evidence attached for manual review.`);
      setStep("context", "unavailable");
      setStep("draft", "done", "Evidence attached for manual review. No automatic recommendation.");
    } else {
      const tally = new Map<string, number>();
      for (const assessment of assessments) {
        tally.set(assessment.preliminaryVerdict, (tally.get(assessment.preliminaryVerdict) ?? 0) + 1);
      }
      const unanimous = tally.size === 1;
      const spread = Array.from(tally.entries())
        .map(([verdict, count]) => `${verdict} ×${count}`)
        .join(", ");

      setStep(
        "compare",
        "done",
        `${assessments.length} independent model(s) read the same ${promptEvidence.length} item(s) from ${independent.length} publisher(s): ${assessments
          .map((assessment) => `${assessment.provider} → ${assessment.preliminaryVerdict}`)
          .join(", ")}.`,
      );

      // ------------------------------------------------ 2. one re-check
      // The re-check goes to the best provider first and fails over from there,
      // so the re-checker is never the analyst that just spoke (when avoidable).
      const adjudicator =
        config.ai.adjudicator ||
        config.ai.chain.find((endpoint) => endpoint.name !== assessments[0].provider)?.name ||
        config.ai.chain[0]?.name ||
        "";

      let finalVerdict = assessments[0].preliminaryVerdict;
      let finalConfidence: ResearchReport["confidence"] = assessments[0].confidence;
      let supporting = assessments[0].supportingSummaryEn;
      let contradicting = assessments[0].contradictingSummaryEn;
      let missing = assessments[0].missingContextEn;
      let notes: { url: string; stance: "supports" | "contradicts" | "context"; noteEn: string }[] = [];
      let modelLabel = `${assessments[0].model} · ${assessments[0].provider}`;
      let reCheck = "not run — only one analyst answered";

      const reCheckBudget = remaining();
      if (assessments.length >= 2 && reCheckBudget < 12_000) {
        reCheck = `re-check skipped — out of time budget (${Math.round(reCheckBudget / 1000)}s left); ${assessments.length} analyst(s) only`;
        console.warn("[research]", reCheck);
      } else if (assessments.length >= 2) {
        const adjudicatorSystem = [
          ...RULES,
          "You are the re-checking analyst. Two or more independent models have assessed the SAME evidence set; their answers are below.",
          "Re-verify their work against the evidence itself: confirm what is right, correct what is wrong, and overturn what the evidence does not support.",
          "If the analysts disagree, say so plainly in missingContextEn and choose the verdict the evidence actually supports — often unverified or disputed.",
          "Do not average opinions and do not invent sources.",
          SCHEMA.replace("You are given", "You are given"),
          BREVITY,
        ].join(" ");
        const analystBlock = assessments
          .map(
            (assessment, index) =>
              `ANALYST ${String.fromCharCode(65 + index)} — ${assessment.provider} (${assessment.model}): ${assessment.preliminaryVerdict} / ${assessment.confidence} confidence\n  Supports: ${assessment.supportingSummaryEn}\n  Contradicts: ${assessment.contradictingSummaryEn}\n  Missing: ${assessment.missingContextEn}`,
          )
          .join("\n\n");

        try {
          /**
           * Two shapes for the re-check: JSON mode first, then a plain answer
           * that only has to contain JSON somewhere. Small models drop out of
           * JSON mode when the completion budget runs short.
           */
          const recheckAttempts: { json: boolean; messages: { role: "system" | "user"; content: string }[]; maxTokens: number }[] = [
            {
              json: true,
              maxTokens: 2000,
              messages: [
                { role: "system", content: adjudicatorSystem },
                {
                  role: "user",
                  content: `${evidenceBlock}\n\nINDEPENDENT ANALYST ANSWERS (${assessments.length}):\n${analystBlock}`,
                },
              ],
            },
            {
              json: false,
              maxTokens: 2000,
              messages: [
                {
                  role: "system",
                  content: `${adjudicatorSystem} Reply with the JSON object only — no commentary before or after it.`,
                },
                {
                  role: "user",
                  content: `${compactBlock}\n\nANALYST ANSWERS (brief):\n${assessments
                    .map((assessment) => `${assessment.provider} (${assessment.model}): ${assessment.preliminaryVerdict} — ${assessment.missingContextEn.slice(0, 140)}`)
                    .join("\n")}`,
                },
              ],
            },
          ];

          let recheck: Awaited<ReturnType<typeof aiComplete>> = null;
          for (const attemptOptions of recheckAttempts) {
            try {
              recheck = await aiComplete(attemptOptions.messages, {
                json: attemptOptions.json,
                temperature: 0,
                maxTokens: attemptOptions.maxTokens,
                timeoutMs: Math.min(120_000, Math.max(12_000, remaining())),
                deadline: Number.isFinite(deadline) ? deadline : undefined,
                prefer: adjudicator || undefined,
                preferModel: config.ai.adjudicatorModel || undefined,
                onTokenLimit: [
                  { role: "system", content: adjudicatorSystem },
                  {
                    role: "user",
                    content: `${compactBlock}\n\nANALYST ANSWERS (brief):\n${assessments
                      .map((assessment) => `${assessment.provider}: ${assessment.preliminaryVerdict} — ${assessment.missingContextEn.slice(0, 120)}`)
                      .join("\n")}`,
                  },
                ],
                onTokenLimitMaxTokens: 1000,
              });
            } catch (error) {
              aiNotice = (error as Error).message;
              console.error("[research] re-check call failed:", aiNotice);
              continue;
            }
            if (recheck && parseAssessment(recheck.text)) break;
            console.warn("[research] re-check output unusable, retrying in prose | raw:", (recheck?.text ?? "").slice(0, 240));
            recheck = null;
          }
          if (recheck) {
            const parsed = parseAssessment(recheck.text);
            if (!parsed) throw new Error("re-check output did not match the assessment shape");
            finalVerdict = parsed.preliminaryVerdict as Verdict;
            finalConfidence = parsed.confidence;
            supporting = parsed.supportingSummaryEn;
            contradicting = parsed.contradictingSummaryEn;
            missing = parsed.missingContextEn;
            notes = parsed.evidenceNotes;
            modelLabel = `${recheck.model} · ${recheck.provider}`;
            reCheck = `${recheck.provider} (${recheck.model}) confirmed after reading ${assessments.length} analyst reports`;
          }
        } catch (error) {
          aiNotice = (error as Error).message;
          console.error("[research] re-check failed:", aiNotice);
          // Fall back to the analysts' own tally rather than their first opinion:
          // a split is itself a finding, and it can never be stronger than unverified.
          const winning = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0];
          finalVerdict = (unanimous ? winning[0] : "unverified") as Verdict;
          finalConfidence = unanimous ? assessments[0].confidence : "low";
          if (!unanimous) {
            missing = [missing, `Analysts disagreed (${spread}); treated as UNVERIFIED pending editorial review.`]
              .filter(Boolean)
              .join("\n\n");
          }
          reCheck = `re-check unavailable (${aiNotice}); ${unanimous ? "analysts were unanimous" : `analysts split ${spread}`}`;
        }
      }

      report = {
        ...report,
        model: modelLabel,
        supportingSummaryEn: supporting,
        contradictingSummaryEn: contradicting,
        missingContextEn: missing,
        preliminaryVerdict: finalVerdict,
        confidence: finalConfidence,
        analysts: assessments.map((assessment) => ({
          ...assessment,
          agreesWithFinal: assessment.preliminaryVerdict === finalVerdict,
        })),
        adjudicator: reCheck,
      };

      for (const note of notes) {
        const match = evidence.find((e) => e.url === note.url);
        if (match) {
          match.stance = note.stance;
          match.noteEn = note.noteEn;
        }
      }

      const strong = finalVerdict === "verified_true" || finalVerdict === "false";
      if (strong && !corroborated) {
        report.preliminaryVerdict = "unverified";
        report.confidence = "low";
        report.missingContextEn = [
          report.missingContextEn,
          `Corroboration floor not met: ${independent.length} independent publisher(s) (${MIN_INDEPENDENT} required, or one primary record). The models suggested ${finalVerdict}; it has been downgraded to UNVERIFIED.`,
        ]
          .filter(Boolean)
          .join("\n\n");
        setStep("corroborate", "unavailable", "Model verdict downgraded — the evidence set is not independent enough to support it.");
      }

      setStep(
        "context",
        "done",
        `${reCheck}${unanimous ? `; analysts unanimous (${spread})` : `; analysts split (${spread})`}.`,
      );
      setStep(
        "draft",
        "done",
        `Preliminary recommendation: ${report.preliminaryVerdict} (${report.confidence} confidence), from ${assessments.length} independent model(s) plus a re-check.`,
      );
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
    /** Every provider the desk will try, in order — keyless last. */
    providers: config.ai.chain.map((endpoint) => endpoint.label),
    /** The cross-check bench: each entry answers independently. */
    analysts: config.ai.analystEndpoints.map((endpoint) => endpoint.label),
    /** What the desk would need to add for full AI synthesis. */
    needs: isAiConfigured()
      ? []
      : ["AI_API_KEY (gemini|groq|openrouter|cerebras|mistral|deepseek) — or set AI_KEYLESS_FALLBACK=1 for the keyless endpoint"],
  };
}
