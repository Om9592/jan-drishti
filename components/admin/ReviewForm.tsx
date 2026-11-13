"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { FactCheck, Verdict } from "@/lib/types";
import { VERDICT_META } from "@/lib/utils";

export function ReviewForm({ factCheck }: { factCheck: FactCheck }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(factCheck.headlineEn);
  const [verdict, setVerdict] = useState<Verdict>(factCheck.verdict);
  const [explanation, setExplanation] = useState(factCheck.explanationEn);
  const [context, setContext] = useState(factCheck.contextEn);
  const [confidence, setConfidence] = useState(factCheck.confidenceLevel);
  const [notes, setNotes] = useState(factCheck.notesForReviewer ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function submit(action: "save" | "publish" | "reject") {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/fact-checks/${factCheck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: factCheck.id,
          verdict,
          explanationEn: explanation,
          contextEn: context,
          confidenceLevel: confidence,
          headlineEn: headline,
          notesForReviewer: notes,
          action,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; fields?: Record<string, string> };
      if (!res.ok || !data.ok) {
        setMessage({
          type: "error",
          text: data.error
            ? `${data.error}${data.fields ? ` ${Object.values(data.fields).join(" ")}` : ""}`
            : "Could not save the decision.",
        });
        return;
      }
      setMessage({
        type: "ok",
        text:
          action === "publish"
            ? "Verdict approved and published. Your name is attached to the report."
            : action === "reject"
              ? "File rejected. Nothing was published."
              : "Saved for further review.",
      });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Request failed. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  const isPublished = factCheck.status === "published";

  return (
    <div className="space-y-4">
      <div className="border border-gold/50 bg-gold/[0.07] p-3">
        <p className="flex items-start gap-2 font-sans text-[0.74rem] leading-relaxed text-ink-soft">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
          {factCheck.research?.preliminary
            ? "The attached research is machine-assisted and preliminary. Verify each evidence item yourself before approving a verdict."
            : "No machine verdict is attached. Write the verdict from the evidence file below."}
        </p>
      </div>

      <div>
        <label htmlFor="headline" className="field-label">
          Headline (published)
        </label>
        <input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} className="field" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="verdict" className="field-label">
            Verdict
          </label>
          <select
            id="verdict"
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as Verdict)}
            className="field"
          >
            {(Object.keys(VERDICT_META) as Verdict[]).map((v) => (
              <option key={v} value={v}>
                {VERDICT_META[v].en}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="confidence" className="field-label">
            Confidence
          </label>
          <select
            id="confidence"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value as FactCheck["confidenceLevel"])}
            className="field"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="explanation" className="field-label">
          Explanation — why this verdict
        </label>
        <textarea
          id="explanation"
          rows={5}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="field resize-y"
        />
      </div>

      <div>
        <label htmlFor="context" className="field-label">
          What actually happened / missing context
        </label>
        <textarea
          id="context"
          rows={4}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="field resize-y"
        />
      </div>

      <div>
        <label htmlFor="notes" className="field-label">
          Internal notes (not published)
        </label>
        <textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field resize-y"
        />
      </div>

      {message && (
        <p
          role="status"
          className={`flex items-center gap-1.5 border px-3 py-2 font-sans text-[0.78rem] ${
            message.type === "ok"
              ? "border-verdict-true/30 bg-verdict-true/[0.05] text-verdict-true"
              : "border-verdict-false/30 bg-verdict-false/[0.05] text-verdict-false"
          }`}
        >
          {message.type === "ok" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        <button type="button" onClick={() => submit("publish")} disabled={busy !== null} className="btn-primary">
          {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isPublished ? "Re-approve & publish" : "Approve & publish verdict"}
        </button>
        <button type="button" onClick={() => submit("save")} disabled={busy !== null} className="btn-outline">
          {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save for review
        </button>
        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={busy !== null}
          className="btn-ghost border border-rule"
        >
          Reject file
        </button>
      </div>

      {isPublished && (
        <p className="font-sans text-[0.7rem] text-ink-muted">
          Published {factCheck.publishedAt ? new Date(factCheck.publishedAt).toLocaleString("en-IN") : ""} · reviewer{" "}
          {factCheck.reviewerName ?? "—"} · version {factCheck.correctionVersion + 1}
        </p>
      )}
    </div>
  );
}
