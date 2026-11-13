"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Approve or reject a freelance contributor application. */
export function ApplicationDecision({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setMessage(null);
    try {
      const res = await fetch("/api/contributors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, decision, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: json.error ?? "Could not record that decision." });
        return;
      }
      setMessage({
        ok: true,
        text:
          decision === "approve"
            ? json.created
              ? `Account created for ${json.email}. Password-set mail ${json.inviteSent ? "sent" : "NOT sent — ask them to use “Forgot password” on /login"}.`
              : `Existing account ${json.email} upgraded to contributor. Password-set mail ${json.inviteSent ? "sent" : "NOT sent"}.`
            : "Application closed.",
      });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network error." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Note for the applicant (optional — sent internally, not published)"
        className="field text-[0.78rem]"
        aria-label="Decision note"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => decide("approve")} disabled={busy !== null} className="btn-primary">
          {busy === "approve" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Approve as contributor
        </button>
        <button type="button" onClick={() => decide("reject")} disabled={busy !== null} className="btn-outline">
          {busy === "reject" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Decline
        </button>
      </div>
      {message && (
        <p
          role="status"
          className={`border px-3 py-2 font-sans text-[0.76rem] ${
            message.ok
              ? "border-verdict-true/30 bg-verdict-true/[0.05] text-verdict-true"
              : "border-verdict-false/30 bg-verdict-false/[0.05] text-verdict-false"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

/** One-click publish for a story that is sitting in the review queue. */
export function PublishStoryButton({
  articleId,
  label = "Approve & publish",
}: {
  articleId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not publish.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={publish}
        disabled={busy}
        className="border border-navy px-2.5 py-1 font-sans text-[0.58rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper disabled:opacity-50"
      >
        {busy ? "Publishing…" : label}
      </button>
      {error && <span className="font-sans text-[0.65rem] text-verdict-false">{error}</span>}
    </span>
  );
}
