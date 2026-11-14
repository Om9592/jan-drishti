"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Bot, ExternalLink, Loader2, RotateCcw, ShieldQuestion, Square, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { VERDICT_META } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

interface ChatSource {
  n: number;
  title: string;
  url: string;
  publisher: string;
  stance: "supports" | "contradicts" | "context";
  sourceType: string;
  publishedAt?: string | null;
}

interface TurnResult {
  id: string;
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
  createdAt: string;
  newestSourceAt?: string | null;
  sourcesLast7Days?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: TurnResult;
  pending?: boolean;
}

const STORE_KEY = "jd_chat_v1";

const SUGGESTIONS = [
  {
    en: "Is it true that the RBI has withdrawn ₹500 notes from circulation?",
    hi: "क्या यह सच है कि RBI ने 500 रुपये के नोट बंद कर दिए हैं?",
  },
  {
    en: "A video says the Yamuna in Delhi is covered in toxic foam again. Is that real?",
    hi: "एक वीडियो कहता है कि दिल्ली में यमुना फिर ज़हरीले झाग से भरी है। क्या यह सच है?",
  },
  {
    en: "Did the government make Aadhaar mandatory for school admissions this year?",
    hi: "क्या सरकार ने इस साल स्कूल दाखिले के लिए आधार अनिवार्य कर दिया है?",
  },
];

function timeAgoShort(iso: string | null | undefined, hi: boolean): string {
  if (!iso) return hi ? "तारीख़ अज्ञात" : "date unknown";
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return hi ? "तारीख़ अज्ञात" : "date unknown";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return hi ? `${minutes} मिनट पहले` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hi ? `${hours} घंटे पहले` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return hi ? `${days} दिन पहले` : `${days}d ago`;
  const months = Math.round(days / 30);
  return hi ? `${months} महीने पहले` : `${months}mo ago`;
}

/**
 * True when the reply summarises retrieved sources rather than judging them —
 * every model was unavailable, or the search failed. Neither should show a
 * verdict word to the reader.
 */
function noModelJudged(flags: string[] | undefined): boolean {
  if (!flags || flags.length === 0) return false;
  return flags.includes("assembled-reply") || flags.includes("no-evidence") || flags.includes("search-failed");
}

function newThreadId(): string {
  return `t-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Turn "…see [2][3]." into text plus citation chips that scroll to the source. */
function renderWithCitations(rawText: string, sources: ChatSource[]) {
  // Providers disagree about brackets: normalise before linking.
  const text = rawText.replace(/[【\[]\s*(\d{1,2})\s*[】\]]/g, "[$1]");
  const parts = text.split(/(\[\d{1,2}\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[(\d{1,2})\]$/);
    if (!match) return <span key={index}>{part}</span>;
    const n = Number(match[1]);
    const source = sources.find((item) => item.n === n);
    if (!source) return <span key={index}>{part}</span>;
    return (
      <a
        key={index}
        href={`#source-${n}`}
        title={`${source.publisher} — ${source.title}`}
        className="mx-0.5 inline-flex h-[1.15em] min-w-[1.15em] items-center justify-center border border-navy/25 px-1 align-super font-sans text-[0.6em] leading-none text-navy hover:border-navy hover:bg-navy hover:text-white"
      >
        {n}
      </a>
    );
  });
}

export function ChatInterface() {
  const { lang } = useLanguage();
  const hi = lang === "hi";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // A refresh should not throw away a conversation that cost a minute to build.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { threadId: string; messages: Message[] };
        if (Array.isArray(parsed.messages)) {
          setMessages(parsed.messages.map((message) => ({ ...message, pending: false })));
          setThreadId(parsed.threadId ?? newThreadId());
          return;
        }
      }
    } catch {
      // A corrupt cache is not worth an error message.
    }
    setThreadId(newThreadId());
  }, []);

  useEffect(() => {
    if (!threadId) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ threadId, messages }));
    } catch {
      // Storage full or blocked; the conversation still works in memory.
    }
  }, [messages, threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, stage]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: question };
      const answerId = `a-${Date.now()}`;
      const history = [...messages, userMessage];
      setMessages([...history, { id: answerId, role: "assistant", content: "", pending: true }]);
      setInput("");
      setBusy(true);
      setError(null);
      setStage(hi ? "शुरू कर रहे हैं" : "Starting");

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (updater: (message: Message) => Message) =>
        setMessages((current) => current.map((message) => (message.id === answerId ? updater(message) : message)));

      try {
        const response = await fetch("/api/fact-check/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            threadId,
            language: lang,
            messages: history.map((message) => ({ role: message.role, content: message.content })),
          }),
        });

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? (hi ? "जाँच पूरी नहीं हो सकी।" : "The check could not be completed."));
          patch((message) => ({ ...message, pending: false, content: "" }));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assembled = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const eventLine = frame.split("\n").find((line) => line.startsWith("event:"));
            const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
            if (!eventLine || !dataLine) continue;
            const event = eventLine.slice(6).trim();
            let data: unknown;
            try {
              data = JSON.parse(dataLine.slice(5).trim());
            } catch {
              continue;
            }

            if (event === "status") {
              const payload = data as { label: string };
              setStage(payload.label);
            } else if (event === "delta") {
              const payload = data as { text: string };
              assembled += payload.text;
              patch((message) => ({ ...message, content: assembled }));
            } else if (event === "done") {
              const result = data as TurnResult & { reply: string };
              patch((message) => ({
                ...message,
                pending: false,
                content: result.reply || assembled,
                result,
              }));
              setStage(null);
            } else if (event === "error") {
              const payload = data as { error: string };
              setError(payload.error);
              patch((message) => ({ ...message, pending: false }));
            }
          }
        }
      } catch (caught) {
        if ((caught as Error).name !== "AbortError") {
          setError(hi ? "सर्वर से संपर्क नहीं हो सका।" : "Could not reach the server.");
        }
      } finally {
        setBusy(false);
        setStage(null);
        abortRef.current = null;
        patch((message) => ({ ...message, pending: false }));
        inputRef.current?.focus();
      }
    },
    [busy, hi, lang, messages, threadId],
  );

  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
    setStage(null);
  };

  return (
    <div className="flex h-[calc(100dvh-19rem)] min-h-[480px] flex-col border border-rule bg-paper">
      <div className="flex items-center justify-between gap-2 border-b border-rule bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-gold-dark" aria-hidden="true" />
          <span className="font-serif text-[0.95rem] text-navy">{hi ? "सत्यापन सहायक" : "Verification assistant"}</span>
          <span className="border border-navy/20 px-1.5 py-0.5 font-sans text-[0.52rem] uppercase tracking-[0.12em] text-ink-muted">
            {hi ? "मशीन जवाब · स्रोत दिखाए गए" : "Machine answer · sources shown"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            abortRef.current?.abort();
            setMessages([]);
            setError(null);
            setStage(null);
            setBusy(false);
            setThreadId(newThreadId());
          }}
          className="inline-flex items-center gap-1 font-sans text-[0.64rem] uppercase tracking-[0.1em] text-ink-muted hover:text-navy"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          {hi ? "नई चैट" : "New chat"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl py-6">
            <h1 className="font-serif text-[1.5rem] leading-snug text-navy">
              {hi ? "जो भी दावा सुना हो, यहाँ लिखें।" : "Ask about any claim you have heard."}
            </h1>
            <p className="mt-2 font-sans text-[0.82rem] leading-relaxed text-ink-soft">
              {hi
                ? "मशीन खुद कई अख़बारों और सरकारी रिकॉर्ड में स्रोत खोजती है, तीन मॉडल एक ही सबूत परखते हैं, और फिर आपको जवाब देती है — साथ में हर स्रोत का लिंक।"
                : "The checker searches reporting and official records itself, three models read the same evidence, and then it answers — with the link to every source it used."}
            </p>
            <ul className="mt-4 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion.en}>
                  <button
                    type="button"
                    onClick={() => send(hi ? suggestion.hi : suggestion.en)}
                    className="w-full border border-rule bg-white px-3 py-2 text-left font-sans text-[0.8rem] leading-snug text-ink-soft transition-colors hover:border-navy hover:text-navy"
                  >
                    {hi ? suggestion.hi : suggestion.en}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex items-start gap-1.5 font-sans text-[0.68rem] leading-relaxed text-ink-muted">
              <ShieldQuestion className="mt-0.5 h-3 w-3 shrink-0 text-gold-dark" aria-hidden="true" />
              {hi
                ? "यह मशीन का जवाब है, संपादक का फ़ैसला नहीं। हर जाँच का रिकॉर्ड संपादकीय डेस्क तक जाता है।"
                : "This is a machine answer, not an editor's verdict. Every check is logged for the editorial desk."}
            </p>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-5">
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <p className="max-w-[85%] bg-navy px-3.5 py-2 font-sans text-[0.85rem] leading-relaxed text-white">
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={message.id} className="border-l-2 border-gold/60 pl-3">
                {message.result && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {noModelJudged(message.result.flags) ? (
                      // No model reached a conclusion. Calling that "unverified"
                      // would read as a finding, which is the opposite of what
                      // happened, so the chip says what it is.
                      <span className="border border-rule bg-subtle px-1.5 py-0.5 font-sans text-[0.56rem] uppercase tracking-[0.12em] text-ink-muted">
                        {hi ? "अभी कोई निर्णय नहीं" : "No verdict yet"}
                      </span>
                    ) : (
                      <>
                        <span
                          className={`border px-1.5 py-0.5 font-sans text-[0.56rem] uppercase tracking-[0.12em] ${
                            VERDICT_META[message.result.verdict]?.tone ?? ""
                          }`}
                        >
                          {hi ? VERDICT_META[message.result.verdict]?.hi : VERDICT_META[message.result.verdict]?.en}
                        </span>
                        <span className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                          {hi ? "विश्वास" : "Confidence"} {message.result.confidence}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {message.content ? (
                  <div className="space-y-2 font-sans text-[0.87rem] leading-relaxed text-ink">
                    {message.content
                      .split(/\n{2,}/)
                      .filter((paragraph) => paragraph.trim())
                      .map((paragraph, index) => (
                        <p key={index}>{renderWithCitations(paragraph, message.result?.sources ?? [])}</p>
                      ))}
                  </div>
                ) : (
                  message.pending && (
                    <p className="flex items-center gap-2 font-sans text-[0.8rem] text-ink-soft" aria-live="polite">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-dark" aria-hidden="true" />
                      {stage ?? (hi ? "जाँच चल रही है…" : "Working…")}
                    </p>
                  )
                )}

                {message.result && (
                  <div className="mt-3 border border-rule bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper px-2.5 py-1.5">
                      <p className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-navy">
                        {hi ? "स्रोत" : "Sources"} · {message.result.sources.length} · {message.result.publishers}{" "}
                        {hi ? "प्रकाशक" : "publishers"}
                      </p>
                      {message.result.newestSourceAt && (
                        <p className="font-sans text-[0.58rem] uppercase tracking-[0.08em] text-ink-muted">
                          {hi ? "सबसे नया" : "Newest"}: {timeAgoShort(message.result.newestSourceAt, hi)}
                          {typeof message.result.sourcesLast7Days === "number" &&
                            ` · ${message.result.sourcesLast7Days} ${hi ? "इस हफ़्ते" : "this week"}`}
                        </p>
                      )}
                    </div>
                    {message.result.sources.length === 0 ? (
                      <p className="flex items-start gap-2 px-2.5 py-2 font-sans text-[0.72rem] leading-relaxed text-verdict-misleading">
                        <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        {hi
                          ? "कोई स्रोत नहीं मिला — यह जाँच नहीं हो सकी, यह नतीजा नहीं है।"
                          : "No source was retrieved — the check could not run. This is not a finding."}
                      </p>
                    ) : (
                      <ol className="divide-y divide-rule">
                        {message.result.sources.map((source) => (
                          <li key={source.n} id={`source-${source.n}`} className="flex gap-2 px-2.5 py-1.5">
                            <span className="mt-0.5 w-4 shrink-0 font-sans text-[0.62rem] text-ink-muted">{source.n}</span>
                            <div className="min-w-0">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="font-sans text-[0.76rem] leading-snug text-navy underline decoration-rule underline-offset-2 hover:decoration-navy"
                              >
                                {source.title}
                                <ExternalLink className="ml-1 inline h-2.5 w-2.5 align-baseline" aria-hidden="true" />
                              </a>
                              <p className="font-sans text-[0.6rem] uppercase tracking-[0.08em] text-ink-muted">
                                {source.publisher} · {timeAgoShort(source.publishedAt, hi)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {message.result && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule pt-1.5 font-sans text-[0.62rem] text-ink-muted">
                    <span>
                      {message.result.analysts.length} {hi ? "मॉडल" : "models"} ·{" "}
                      {message.result.evidenceChecked} {hi ? "सबूत" : "evidence"} ·{" "}
                      {Math.round(message.result.durationMs / 1000)}s
                    </span>
                    {message.result.analysts.some((analyst) => !analyst.agrees) && (
                      <span className="text-verdict-misleading">{hi ? "मतभेद दर्ज" : "dissent recorded"}</span>
                    )}
                    {!message.result.recorded && (
                      <span className="inline-flex items-center gap-1 text-verdict-misleading">
                        <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
                        {hi ? "डेस्क को रिकॉर्ड नहीं गया" : "not logged for the desk"}
                      </span>
                    )}
                    <Link href="/fact-checking-methodology" className="underline underline-offset-2 hover:text-navy">
                      {hi ? "हमारा तरीका" : "How we check"}
                    </Link>
                  </div>
                )}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      {error && (
        <p className="mx-3 mb-2 flex items-start gap-2 border border-verdict-false/40 bg-verdict-false/[0.06] px-3 py-2 font-sans text-[0.76rem] leading-relaxed text-verdict-false">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="border-t border-rule bg-white px-3 py-2.5 sm:px-4"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={1500}
            placeholder={
              hi
                ? "कोई दावा या सवाल लिखें… (Shift+Enter से नई लाइन)"
                : "Ask about a claim or a news report… (Shift+Enter for a new line)"
            }
            className="max-h-40 min-h-[2.6rem] flex-1 resize-y border border-rule bg-paper px-3 py-2 font-sans text-[0.87rem] leading-relaxed text-ink outline-none focus:border-navy"
            disabled={busy}
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex h-[2.6rem] items-center gap-1 border border-rule bg-white px-3 font-sans text-[0.7rem] uppercase tracking-[0.1em] text-ink-soft hover:border-navy hover:text-navy"
            >
              <Square className="h-3 w-3" aria-hidden="true" />
              {hi ? "रोकें" : "Stop"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={input.trim().length === 0}
              className="btn-primary h-[2.6rem] px-3.5 disabled:opacity-40"
              aria-label={hi ? "भेजें" : "Send"}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
