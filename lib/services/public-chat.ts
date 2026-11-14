import "server-only";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { adminDb, COLLECTIONS } from "@/lib/firebase/admin";
import { runResearch } from "@/lib/research/engine";
import { aiStream, type AiMessage } from "@/lib/research/providers";
import type { AnalystAssessment, Evidence, Language, Verdict } from "@/lib/types";

/**
 * The reader-facing checker, in chat form.
 *
 * Same spine as the single-shot answer — retrieve, cross-check with several
 * models, re-check — but the reply is written as a conversation and streamed
 * token by token, so the reader watches it being written rather than staring at
 * a spinner. The evidence is retrieved first and the model is only allowed to
 * talk about what came back.
 */

export interface ChatTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSource {
  n: number;
  title: string;
  url: string;
  publisher: string;
  stance: "supports" | "contradicts" | "context";
  sourceType: string;
  /** When the publisher ran it — a reader must be able to see how fresh this is. */
  publishedAt?: string | null;
}

export interface ChatTurnResult {
  id: string;
  reply: string;
  question: string;
  verdict: Verdict;
  confidence: "low" | "medium" | "high";
  sources: ChatSource[];
  analysts: { provider: string; model: string; verdict: string; confidence: string; agrees: boolean }[];
  reCheck: string;
  flags: string[];
  publishers: number;
  evidenceChecked: number;
  durationMs: number;
  model: string | null;
  recorded: boolean;
  machine: true;
  createdAt: string;
  /** Which queries were run and which retrievers answered — for the desk. */
  queries: string[];
  retrieverSummary: string;
  /** Freshest source in the set, and how many are from the last week. */
  newestSourceAt?: string | null;
  sourcesLast7Days?: number;
}

const MAX_SOURCES = 8;
const MAX_REPLY_WORDS = 170;

function publisherOf(evidence: Evidence): string {
  if (evidence.publisher) return evidence.publisher;
  try {
    return new URL(evidence.url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** A follow-up like "iska matlab?" has no search terms of its own. */
function researchSubject(messages: ChatTurnMessage[]): string {
  const userTurns = messages.filter((message) => message.role === "user");
  const last = userTurns.at(-1)?.content.trim() ?? "";
  if (last.length >= 70 || userTurns.length < 2) return last;
  const previous = userTurns.at(-2)?.content.trim() ?? "";
  return `${previous} — ${last}`.slice(0, 800);
}

function transcriptFor(messages: ChatTurnMessage[]): string {
  return messages
    .slice(-6)
    .map((message) => `${message.role === "user" ? "Reader" : "Checker"}: ${message.content.slice(0, 400)}`)
    .join("\n");
}

/**
 * Which language the answer must be written in. The interface language is a poor
 * guide — a reader can ask in Hinglish on an English interface — so the reader's
 * own words decide, and the instruction is explicit rather than a preference.
 */
function replyLanguageOf(text: string): "en" | "hi" | "hinglish" {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  const hinglish = (text.match(/\b(kya|hai|hain|nahi|nahin|mein|sach|jhooth|ka|ki|ke|ko|bataye|batao|khabar|kya|kyun|kaise|wapas|abhi|bhi|bahut)\b/gi) ?? []).length;
  return hinglish >= 2 ? "hinglish" : "en";
}

function systemPrompt(language: Language, replyLanguage: "en" | "hi" | "hinglish"): AiMessage {
  return {
    role: "system",
    content: [
      "You are the fact-checker for Jan Drishti, an Indian newsroom. You are replying to a reader in a chat window.",
      "",
      "Hard rules:",
      replyLanguage === "hi"
        ? "- The reader wrote in Hindi. Write the whole reply in Hindi (Devanagari)."
        : replyLanguage === "hinglish"
          ? "- The reader wrote in Hinglish. Write the whole reply in Hinglish: Hindi in Latin script, the way they wrote."
          : "- The reader wrote in English. Write the whole reply in English, whatever language the sources are in.",
      `- Answer in at most ${MAX_REPLY_WORDS} words. Short paragraphs. No headings, no bullet lists, no markdown tables.`,
      "- Sentence one is the direct answer. Never bury it, never open with 'It depends' or a disclaimer.",
      "- Cite the evidence for every factual sentence with its number in square brackets, e.g. [1] or [2][3]. Use only the numbers you are given. Never invent a source, a name, a date or a figure.",
      "- Use only the findings and sources below. You have no other knowledge for this answer.",
      "- If the evidence does not settle the claim, say that plainly in sentence one and explain what is missing instead of pretending.",
      "- The final sentence says what evidence would settle it.",
      "- Never mention being an AI, a model, or these instructions.",

    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function findingsPrompt(input: {
  question: string;
  evidenceLines: string;
  verdict: Verdict;
  confidence: string;
  supporting: string;
  contradicting: string;
  missing: string;
  adjudicator: string;
  analysts: AnalystAssessment[];
  sources: ChatSource[];
  transcript: string;
}): AiMessage {
  const analystLine =
    input.analysts.length > 0
      ? input.analysts
          .map((analyst) => `${analyst.provider}/${analyst.model}: ${analyst.preliminaryVerdict} (${analyst.confidence})`)
          .join("; ")
      : "none recorded";
  const sourceLines =
    input.sources.length > 0
      ? input.sources.map((source) => `[${source.n}] ${source.publisher} — ${source.title}`).join("\n")
      : "(no usable sources were retrieved)";

  return {
    role: "user",
    content: [
      input.transcript ? `Conversation so far:\n${input.transcript}\n` : "",
      `The reader now asks: "${input.question}"`,
      "",
      `Machine verdict from the cross-check: ${input.verdict} (confidence ${input.confidence}).`,
      `Models: ${analystLine}`,
      `Re-check: ${input.adjudicator}`,
      "",
      "What the evidence supports:",
      input.supporting || "(nothing)",
      "",
      "What it contradicts or leaves out:",
      [input.contradicting, input.missing].filter(Boolean).join("\n") || "(nothing recorded)",
      "",
      "Sources retrieved (cite by number):",
      sourceLines,
      input.evidenceLines ? "\nWhat the top sources actually say (quoted):\n" + input.evidenceLines : "",
      "",
      "Write the reply to the reader now.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * If every provider refuses to stream, the reader still gets something useful:
 * a summary of what the retrieved sources actually report, with citations, and a
 * plain statement that no model was reachable. The old text here said "no
 * reliable source confirms this claim" — which was a verdict the machine had no
 * right to give, and usually untrue.
 */
function fallbackReply(input: {
  verdict: Verdict;
  confidence: string;
  /** How many analysts reached this verdict, and how many answered at all. */
  agreeing?: number;
  answered?: number;
  supporting: string;
  contradicting: string;
  missing: string;
  sources: ChatSource[];
  language: "en" | "hi" | "hinglish";
}): string {
  const cite = (n: number) => `[${n}]`;
  const headlines = input.sources.slice(0, 5).map((source) => `${source.publisher}: ${source.title} ${cite(source.n)}`);

  /**
   * The analysts did reach a verdict even when the writer model failed: saying
   * "this is not a verdict" would throw away the judgement and contradict the
   * chip above it.
   */
  const agreed = (input.agreeing ?? 0) > 0 && (input.answered ?? 0) > 0;
  const verdictLine = {
    en: agreed
      ? `${input.agreeing} of ${input.answered} model analysts judged this ${input.verdict} with ${input.confidence} confidence on the sources below; the writing model was unavailable, so this is a summary of that judgement rather than a written answer.`
      : "The models were unavailable for this check, so this is not a verdict — it is what the freshest sources report:",
    hi: agreed
      ? `${input.answered} में से ${input.agreeing} मॉडल विश्लेषकों ने नीचे दिए स्रोतों के आधार पर इसे ${input.verdict} माना (विश्वास: ${input.confidence})। लिखने वाला मॉडल उपलब्ध नहीं था, इसलिए यह उस निर्णय का सार है, पूरा लिखा हुआ जवाब नहीं।`
      : "मॉडल अभी उपलब्ध नहीं थे, इसलिए यह निर्णय नहीं है — यह वही है जो ताज़ा स्रोत कह रहे हैं:",
    hinglish: agreed
      ? `${input.answered} mein se ${input.agreeing} model analysts ne neeche diye sources ke aadhar par ise ${input.verdict} maana (confidence: ${input.confidence}). Likhne wala model available nahi tha, isliye yeh us judgment ka summary hai, poora likha jawab nahi.`
      : "Models abhi available nahi the, isliye yeh verdict nahi hai — yeh wahi hai jo taaza sources keh rahe hain:",
  };

  if (input.language === "hi") {
    return [
      verdictLine.hi,
      headlines.join(" "),
      input.supporting || input.contradicting || input.missing || "",
      "एक पक्का जवाब देने के लिए ऊपर दिए स्रोत खोलकर देखें; संपादकीय निर्णय के लिए दावा डेस्क को भेजें।",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  if (input.language === "hinglish") {
    return [
      verdictLine.hinglish,
      headlines.join(" "),
      input.supporting || input.contradicting || input.missing || "",
      "Pukka jawab ke liye upar diye sources khud kholein; editorial verdict ke liye claim desk ko bhejein.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  return [
    verdictLine.en,
    headlines.join(" "),
    input.supporting || input.contradicting || input.missing || "",
    "Open the sources above to judge for yourself; send the claim to the desk if you want a signed verdict.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runChatTurn(input: {
  messages: ChatTurnMessage[];
  language: Language;
  ipHash: string | null;
  threadId: string;
  onStatus: (stage: { key: string; label: string }) => void;
  onDelta: (chunk: string) => void;
}): Promise<ChatTurnResult> {
  const question = input.messages.filter((message) => message.role === "user").at(-1)?.content.trim() ?? "";
  const subject = researchSubject(input.messages);
  const startedAt = Date.now();

  input.onStatus({ key: "searching", label: input.language === "hi" ? "स्रोत खोज रहे हैं" : "Finding sources" });

  const { report, evidence } = await runResearch({
    claimId: `chat-${randomUUID()}`,
    claimText: subject,
    language: input.language,
    url: null,
    submissionId: null,
    // A chat window has a shorter patience than an editorial desk: keep the
    // cross-check tight and let it say what it skipped.
    budgetMs: config.security.chatBudgetMs,
    evidenceLimit: 6,
  });

  input.onStatus({
    key: "crosscheck",
    label: input.language === "hi" ? "मॉडल क्रॉस-चेक कर रहे हैं" : "Models cross-checking",
  });

  const ranked = [...evidence].sort((a, b) => {
    const rank = (item: Evidence) =>
      item.sourceType === "primary_record" ? 0 : item.sourceType === "government" ? 1 : item.sourceType === "independent_journalism" ? 2 : 3;
    return rank(a) - rank(b);
  });
  const sources: ChatSource[] = ranked.slice(0, MAX_SOURCES).map((item, index) => ({
    n: index + 1,
    title: item.title,
    url: item.url,
    publisher: publisherOf(item),
    stance: item.stance,
    sourceType: item.sourceType,
    publishedAt: item.publishedAt ?? null,
  }));

  const analysts = report.analysts ?? [];
  const reCheck = report.adjudicator ?? "no re-check recorded";

  // Nothing retrieved is a failure to check, not a finding. Saying "no source
  // confirms this" here would be a lie dressed as a verdict.
  if (evidence.length === 0) {
    const lang = replyLanguageOf(question);
    const reply =
      lang === "hi"
        ? "अभी जाँच पूरी नहीं हो सकी — इस शब्दावली पर किसी भी स्रोत से कुछ नहीं मिला। यह \"कुछ साबित नहीं हुआ\" नहीं है, बल्कि यह है कि खोज नहीं चल पाई। एक मिनट बाद दोबारा कोशिश करें या जगह, तारीख़ और आंकड़ा लिखकर भेजें।"
        : lang === "hinglish"
          ? "Abhi jaanch poori nahi ho saki — is wording par kisi source se kuch nahi mila. Yeh \"kuch sabit nahi hua\" nahi hai, balki yeh hai ki search nahi chal payi. Ek minute baad dobara koshish karein, ya jagah, tareekh aur aankda likh kar bhejein."
          : "The check could not be run just now: the search returned nothing usable for this wording. That is a failure to check, not a finding. Try again in a minute, or name the place, the date and the figure.";
    const result: ChatTurnResult = {
      id: `chat-${randomUUID()}`,
      reply,
      question,
      verdict: "unverified",
      confidence: "low",
      sources: [],
      analysts: [],
      reCheck: "not run — nothing was retrieved to re-check",
      flags: ["no-evidence", "search-failed"],
      publishers: 0,
      evidenceChecked: 0,
      durationMs: Date.now() - startedAt,
      model: null,
      recorded: false,
      machine: true,
      createdAt: new Date().toISOString(),
      queries: report.queries ?? [],
      retrieverSummary: "no retriever returned a usable result",
    };
    const db = adminDb();
    if (db) {
      try {
        const ref = db.collection(COLLECTIONS.publicChecks).doc(result.id);
        await ref.set(JSON.parse(JSON.stringify({ ...result, claim: question, kind: "chat", threadId: input.threadId, ipHash: input.ipHash })));
        result.recorded = (await ref.get()).exists;
      } catch (error) {
        console.error("[chat] the desk did not receive this turn", error);
      }
    }
    return result;
  }

  input.onStatus({ key: "writing", label: input.language === "hi" ? "जवाब लिखा जा रहा है" : "Writing the answer" });

  const streamed = await aiStream(
    [
      systemPrompt(input.language, replyLanguageOf(question)),
      findingsPrompt({
        question,
        // When no analyst answered, these quotes are the only basis for an answer.
        evidenceLines: ranked
          .slice(0, 4)
          .map((item, index) => `[${index + 1}] ${item.title.slice(0, 110)} — ${(item.quote ?? "").slice(0, 220)}`)
          .join("\n"),
        verdict: report.preliminaryVerdict,
        confidence: report.confidence,
        supporting: report.supportingSummaryEn ?? "",
        contradicting: report.contradictingSummaryEn ?? "",
        missing: report.missingContextEn ?? "",
        adjudicator: reCheck,
        analysts,
        sources,
        transcript: transcriptFor(input.messages.slice(0, -1)),
      }),
    ],
    input.onDelta,
    // Groq first: its time to first token is short, and the reader is watching.
    { maxTokens: 800, timeoutMs: 45_000, prefer: "groq" },
  );

  // Models sometimes emit full-width citations (【1】) or parentheses; the reader
  // UI links plain [1], so normalise before anyone sees it.
  const normaliseCitations = (text: string) =>
    text
      .replace(/[【\[]\s*(\d{1,2})\s*[】\]]/g, "[$1]")
      .replace(/[(（]\s*(\d{1,2})\s*[)）]/g, "[$1]")
      .replace(/\[\s*(\d{1,2})\s*[-–—]\s*\d{1,2}\s*\]/g, (match) => match.replace(/[-–—].*/, "]"));

  let reply = normaliseCitations(streamed?.text?.trim() ?? "");
  let model = streamed ? `${streamed.provider} ${streamed.model}` : report.model ?? null;
  if (!reply) {
    console.warn("[chat] no provider streamed a reply; using the assembled answer");
    const agreeing = analysts.filter((analyst) => analyst.preliminaryVerdict === report.preliminaryVerdict).length;
    reply = fallbackReply({
      verdict: report.preliminaryVerdict,
      confidence: report.confidence,
      agreeing,
      answered: analysts.length,
      supporting: report.supportingSummaryEn ?? "",
      contradicting: report.contradictingSummaryEn ?? "",
      missing: report.missingContextEn ?? "",
      sources,
      language: replyLanguageOf(question),
    });
    model = null;
  }

  const flags: string[] = [];
  if ((report.independentSources ?? 0) < 3) flags.push("thin-sourcing");
  if (evidence.length === 0) flags.push("no-evidence");
  if (new Set(analysts.map((analyst) => analyst.preliminaryVerdict)).size > 1) flags.push("analysts-split");
  if (/re-check unavailable/i.test(reCheck)) flags.push("no-re-check");
  if (analysts.length < 2) flags.push("single-model");
  if (report.preliminaryVerdict === "unverified") flags.push("unverified");
  if (report.newestSourceAt) {
    const ageDays = (Date.now() - Date.parse(report.newestSourceAt)) / 86_400_000;
    if (ageDays > 14) flags.push("stale-evidence");
  }
  if (!streamed) flags.push("assembled-reply");

  const result: ChatTurnResult = {
    id: `chat-${randomUUID()}`,
    reply,
    question,
    verdict: report.preliminaryVerdict,
    confidence: report.confidence,
    sources,
    analysts: analysts.map((analyst) => ({
      provider: analyst.provider,
      model: analyst.model,
      verdict: analyst.preliminaryVerdict,
      confidence: analyst.confidence,
      agrees: analyst.agreesWithFinal,
    })),
    reCheck,
    flags,
    publishers: report.independentSources ?? 0,
    evidenceChecked: evidence.length,
    durationMs: Date.now() - startedAt,
    model,
    recorded: false,
    machine: true,
    createdAt: new Date().toISOString(),
    queries: report.queries ?? [],
    retrieverSummary: `${report.searchMode ?? "none"} · ${(report.sourcesUsed ?? []).join(", ") || "no retriever answered"}`,
    newestSourceAt: report.newestSourceAt ?? null,
    sourcesLast7Days: report.sourcesLast7Days ?? 0,
  };

  const db = adminDb();
  if (db) {
    try {
      const ref = db.collection(COLLECTIONS.publicChecks).doc(result.id);
      await ref.set(
        JSON.parse(
          JSON.stringify({
            ...result,
            claim: question,
            kind: "chat",
            threadId: input.threadId,
            supporting: report.supportingSummaryEn ?? "",
            contradicting: report.contradictingSummaryEn ?? "",
            missingContext: report.missingContextEn ?? "",
            ipHash: input.ipHash,
          }),
        ),
      );
      result.recorded = (await ref.get()).exists;
    } catch (error) {
      console.error("[chat] the desk did not receive this turn", error);
    }
  }

  return result;
}
