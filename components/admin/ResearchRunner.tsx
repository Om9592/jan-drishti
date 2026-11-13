"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import type { ResearchReport } from "@/lib/types";

export function ResearchRunner({
  submissionId,
  defaultText = "",
  compact = false,
}: {
  submissionId?: string;
  defaultText?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(defaultText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ factCheckId: string; report: ResearchReport } | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimText: text, language: "en", submissionId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        factCheckId?: string;
        report?: ResearchReport;
        error?: string;
        fields?: Record<string, string>;
      };
      if (!res.ok || !data.ok || !data.factCheckId || !data.report) {
        setError(data.error ?? "Research failed.");
        return;
      }
      setResult({ factCheckId: data.factCheckId, report: data.report });
      router.refresh();
    } catch {
      setError("Research request failed. Check the server logs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-rule bg-white p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold-dark" aria-hidden="true" />
        <h3 className="font-serif text-[1.05rem] text-navy">Run research</h3>
      </div>
      <p className="mt-1 font-sans text-[0.72rem] leading-relaxed text-ink-muted">
        Builds a preliminary evidence file. Output cannot be published from here — an editor must review and sign the
        verdict.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={compact ? 3 : 5}
        placeholder="Paste the exact claim, as it reached the reader…"
        className="field mt-3 resize-y"
      />

      {error && (
        <p role="alert" className="mt-2 border border-verdict-false/30 bg-verdict-false/[0.05] px-2.5 py-1.5 font-sans text-[0.74rem] text-verdict-false">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={busy || text.trim().length < 20} className="btn-primary">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Running research…" : "Build evidence file"}
        </button>
        {result && (
          <a
            href={`/admin/fact-checks/${result.factCheckId}`}
            className="font-sans text-[0.66rem] uppercase tracking-[0.1em] text-navy underline decoration-gold underline-offset-2"
          >
            Open review file
          </a>
        )}
      </div>

      {result && (
        <div className="mt-3 space-y-2 border-t border-rule pt-3">
          <p className="font-sans text-[0.7rem] uppercase tracking-[0.1em] text-ink-muted">
            Preliminary recommendation: <span className="text-navy">{result.report.preliminaryVerdict}</span> ·{" "}
            {result.report.confidence} confidence
          </p>
          <ul className="space-y-1">
            {result.report.steps.map((step) => (
              <li key={step.key} className="flex items-start gap-2 font-sans text-[0.72rem] text-ink-soft">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${
                    step.status === "done"
                      ? "bg-verdict-true"
                      : step.status === "unavailable"
                        ? "bg-verdict-misleading"
                        : "bg-rule-strong"
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {step.labelEn}
                  {step.detail ? <span className="text-ink-muted"> — {step.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="font-sans text-[0.66rem] leading-relaxed text-ink-muted">
            AI configured: {result.report.aiConfigured ? "yes" : "no"} · Evidence search configured:{" "}
            {result.report.searchConfigured ? "yes" : "no"} · This output is preliminary and unpublishable.
          </p>
        </div>
      )}
    </div>
  );
}
