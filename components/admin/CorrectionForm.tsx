"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { Article, FactCheck } from "@/lib/types";

export function CorrectionForm({
  articles,
  factChecks,
}: {
  articles: Pick<Article, "id" | "title">[];
  factChecks: Pick<FactCheck, "id" | "headlineEn">[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [severity, setSeverity] = useState<"minor" | "material" | "clarification">("material");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const [kind, id] = target.split(":");
    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: kind === "article" ? id : undefined,
          factCheckId: kind === "factcheck" ? id : undefined,
          summaryEn: summary,
          detailEn: detail,
          severity,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage({ type: "error", text: data.error ?? "Could not record the correction." });
        return;
      }
      setMessage({ type: "ok", text: "Correction recorded and attached to the item." });
      setSummary("");
      setDetail("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Request failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border border-rule bg-white p-4">
      <h3 className="font-serif text-[1.05rem] text-navy">Issue a correction</h3>
      <div>
        <label htmlFor="target" className="field-label">Applies to</label>
        <select id="target" value={target} onChange={(e) => setTarget(e.target.value)} className="field" required>
          <option value="">Select an article or report…</option>
          <optgroup label="Articles">
            {articles.map((a) => (
              <option key={a.id} value={`article:${a.id}`}>{a.title}</option>
            ))}
          </optgroup>
          <optgroup label="Fact checks">
            {factChecks.map((f) => (
              <option key={f.id} value={`factcheck:${f.id}`}>{f.headlineEn}</option>
            ))}
          </optgroup>
        </select>
      </div>
      <div>
        <label htmlFor="summary" className="field-label">Public notice</label>
        <input
          id="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="field"
          required
          minLength={10}
          placeholder="What changed, in one sentence"
        />
      </div>
      <div>
        <label htmlFor="detail" className="field-label">Detail (optional)</label>
        <textarea
          id="detail"
          rows={3}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className="field resize-y"
          placeholder="Why the error happened and what was corrected"
        />
      </div>
      <div>
        <label htmlFor="severity" className="field-label">Severity</label>
        <select
          id="severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as typeof severity)}
          className="field"
        >
          <option value="material">Material correction</option>
          <option value="clarification">Clarification</option>
          <option value="minor">Minor correction</option>
        </select>
      </div>
      {message && (
        <p
          role="status"
          className={`border px-3 py-2 font-sans text-[0.78rem] ${
            message.type === "ok"
              ? "border-verdict-true/30 bg-verdict-true/[0.05] text-verdict-true"
              : "border-verdict-false/30 bg-verdict-false/[0.05] text-verdict-false"
          }`}
        >
          {message.text}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Record correction
      </button>
    </form>
  );
}
