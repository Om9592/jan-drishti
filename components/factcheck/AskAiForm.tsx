"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ExternalLink, Loader2, ShieldQuestion, TriangleAlert } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { VERDICT_META } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

interface AnswerSource {
  title: string;
  url: string;
  publisher: string;
  sourceType: string;
  stance: "supports" | "contradicts" | "context";
  noteEn?: string;
}

interface PublicAnswer {
  id: string;
  claim: string;
  verdict: Verdict;
  confidence: "low" | "medium" | "high";
  headline: string;
  supporting: string;
  contradicting: string;
  missingContext: string;
  sources: AnswerSource[];
  analysts: { provider: string; model: string; verdict: string; confidence: string; agrees: boolean }[];
  reCheck: string;
  publishers: number;
  evidenceChecked: number;
  durationMs: number;
  model: string | null;
  flags: string[];
  createdAt: string;
  machine: true;
  recorded?: boolean;
}

const STEPS = [
  { en: "Reading the claim and picking search terms", hi: "दावा पढ़कर खोज शब्द तैयार हो रहे हैं" },
  { en: "Retrieving reports from multiple outlets", hi: "कई अख़बारों से रिपोर्टें लाई जा रही हैं" },
  { en: "Two or more models judging the same evidence", hi: "दो या अधिक मॉडल एक ही सबूत परख रहे हैं" },
  { en: "A third pass re-checking their answers", hi: "तीसरा पास उनके जवाब दोबारा जाँच रहा है" },
];

const STANCE_LABEL: Record<AnswerSource["stance"], { en: string; hi: string }> = {
  supports: { en: "Supports", hi: "समर्थन" },
  contradicts: { en: "Contradicts", hi: "खंडन" },
  context: { en: "Context", hi: "संदर्भ" },
};

export function AskAiForm() {
  const { lang } = useLanguage();
  const hi = lang === "hi";
  const [claim, setClaim] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<PublicAnswer | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStep((current) => (current + 1) % STEPS.length), 9000);
    return () => clearInterval(timer);
  }, [busy]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (claim.trim().length < 15) {
      setError(hi ? "कम से कम 15 अक्षर लिखें।" : "Write at least 15 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setAnswer(null);
    setStep(0);
    try {
      const res = await fetch("/api/fact-check/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: claim.trim(), language: lang }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        answer?: PublicAnswer;
        error?: string;
        fields?: Record<string, string>;
      };
      if (!res.ok || !data.ok || !data.answer) {
        setError(data.error ?? (hi ? "जाँच पूरी नहीं हो सकी।" : "The check could not be completed."));
        return;
      }
      setAnswer(data.answer);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch {
      setError(
        hi
          ? "सर्वर से संपर्क नहीं हो सका। दोबारा कोशिश करें।"
          : "Could not reach the server. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const meta = answer ? VERDICT_META[answer.verdict] : null;

  return (
    <div className="border border-rule bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-gold-dark" aria-hidden="true" />
          <h2 className="font-serif text-[1.15rem] text-navy">
            {hi ? "तुरंत AI जाँच — जवाब यहीं" : "Check it now — answer on this page"}
          </h2>
        </div>
        <span className="border border-navy/20 px-1.5 py-0.5 font-sans text-[0.55rem] uppercase tracking-[0.14em] text-ink-muted">
          {hi ? "मशीन जवाब · 30–60 सेकंड" : "Machine answer · 30–60s"}
        </span>
      </div>

      <form onSubmit={submit} className="px-5 py-4">
        <label htmlFor="ask-claim" className="font-sans text-[0.7rem] uppercase tracking-[0.1em] text-ink-muted">
          {hi ? "कौन सा दावा जाँचना है?" : "What claim should be checked?"}
        </label>
        <textarea
          id="ask-claim"
          value={claim}
          onChange={(event) => setClaim(event.target.value)}
          rows={3}
          maxLength={800}
          placeholder={
            hi
              ? "जैसे: दिल्ली में यमुना में पाँच हज़ार से ज़्यादा मरी मछलियाँ मिली हैं और सरकार ने जाँच के आदेश दिए हैं।"
              : "e.g. More than five thousand dead fish were found in the Yamuna in Delhi and the government has ordered a probe."
          }
          className="mt-1.5 w-full border border-rule bg-paper px-3 py-2 font-sans text-[0.88rem] leading-relaxed text-ink outline-none focus:border-navy"
          disabled={ busy }
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[0.66rem] leading-relaxed text-ink-muted">
            {hi ? `${claim.length}/800 अक्षर` : `${claim.length}/800 characters`}
          </p>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {hi ? "जाँच चल रही है…" : "Checking…"}
              </>
            ) : (
              hi ? "अभी जाँचें" : "Check this claim"
            )}
          </button>
        </div>

        {busy && (
          <p className="mt-3 flex items-center gap-2 font-sans text-[0.74rem] text-ink-soft" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-dark" aria-hidden="true" />
            {hi ? STEPS[step].hi : STEPS[step].en}
          </p>
        )}

        {error && (
          <p className="mt-3 flex items-start gap-2 border border-verdict-false/40 bg-verdict-false/[0.06] px-3 py-2 font-sans text-[0.76rem] leading-relaxed text-verdict-false">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </form>

      {answer && meta && (
        <div ref={resultRef} className="border-t-2 border-navy bg-paper px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-0.5 font-sans text-[0.6rem] uppercase tracking-[0.14em] ${meta.tone}`}>
              {hi ? meta.hi : meta.en}
            </span>
            <span className="font-sans text-[0.66rem] uppercase tracking-[0.1em] text-ink-muted">
              {hi ? "विश्वास" : "Confidence"}: {answer.confidence}
            </span>
            <span className="font-sans text-[0.66rem] uppercase tracking-[0.1em] text-ink-muted">
              {answer.evidenceChecked} {hi ? "सबूत" : "evidence items"} · {answer.publishers}{" "}
              {hi ? "प्रकाशक" : "publishers"}
            </span>
          </div>

          <h3 className="mt-2 font-serif text-[1.2rem] leading-snug text-navy">{answer.headline}</h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="border border-rule bg-white p-3">
              <p className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                {hi ? "क्या मिला" : "What the evidence says"}
              </p>
              <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                {answer.supporting || "—"}
              </p>
            </div>
            <div className="border border-rule bg-white p-3">
              <p className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                {hi ? "क्या नहीं मिला" : "What is missing"}
              </p>
              <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                {answer.contradicting || answer.missingContext || "—"}
              </p>
            </div>
            <div className="border border-rule bg-white p-3">
              <p className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                {hi ? "क्या देखना बाकी है" : "What would settle it"}
              </p>
              <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                {answer.missingContext || "—"}
              </p>
            </div>
          </div>

          {answer.sources.length > 0 && (
            <div className="mt-4">
              <p className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                {hi ? "जिन स्रोतों से जाँच हुई" : "Sources this was checked against"}
              </p>
              <ul className="mt-1.5 divide-y divide-rule border-y border-rule">
                {answer.sources.map((source) => (
                  <li key={source.url} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-sans text-[0.79rem] leading-snug text-navy underline decoration-rule underline-offset-2 hover:decoration-navy"
                      >
                        {source.title}
                        <ExternalLink className="ml-1 inline h-3 w-3 align-baseline" aria-hidden="true" />
                      </a>
                      <p className="font-sans text-[0.64rem] uppercase tracking-[0.08em] text-ink-muted">
                        {source.publisher}
                        {source.stance === "context" ? "" : ` · ${STANCE_LABEL[source.stance][hi ? "hi" : "en"]}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 border border-rule bg-white p-3">
            <p className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
              {hi ? "क्रॉस-चेक" : "Cross-check"}
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {answer.analysts.map((analyst) => (
                <li key={`${analyst.provider}-${analyst.model}`} className="font-sans text-[0.72rem] text-ink-soft">
                  <span className="font-medium text-navy">{analyst.provider}</span> · {analyst.model} → {analyst.verdict}
                  {analyst.agrees ? "" : ` (${hi ? "असहमत" : "dissented"})`}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 font-sans text-[0.68rem] leading-relaxed text-ink-muted">
              {hi ? "पुनः जाँच" : "Re-check"}: {answer.reCheck}
            </p>
          </div>

          <p className="mt-3 flex items-start gap-2 font-sans text-[0.68rem] leading-relaxed text-ink-muted">
            <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
            {hi
              ? "यह मशीन का जवाब है, संपादक का फ़ैसला नहीं। स्रोत नीचे दिए हैं — खुद भी देख लें। यह जाँच संपादकीय डेस्क के रिकॉर्ड में दर्ज हो गई है; प्रकाशित निर्णय केवल मानव संपादक देता है।"
              : "This is a machine answer, not an editor's verdict. The sources are listed above so you can check them yourself. This check has been recorded for the editorial desk; published verdicts are issued only after human review."}
          </p>

          {answer.recorded === false && (
            <p className="mt-2 flex items-start gap-2 font-sans text-[0.68rem] leading-relaxed text-verdict-misleading">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {hi
                ? "सूचना: यह जाँच संपादकीय डेस्क के रिकॉर्ड में दर्ज नहीं हो सकी।"
                : "Note: this check could not be logged for the editorial desk."}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/fact-check" className="btn-outline">
              {hi ? "सभी प्रकाशित फ़ैक्ट-चेक" : "Browse published fact-checks"}
            </Link>
            <button
              type="button"
              className="font-sans text-[0.7rem] uppercase tracking-[0.1em] text-ink-muted underline underline-offset-2 hover:text-navy"
              onClick={() => {
                setAnswer(null);
                setClaim("");
              }}
            >
              {hi ? "दूसरा दावा जाँचें" : "Check another claim"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
