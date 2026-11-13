"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ResearchRunner } from "@/components/admin/ResearchRunner";
import type { Submission, SubmissionStatus } from "@/lib/types";

const STATUSES: SubmissionStatus[] = ["received", "triaged", "researching", "rejected"];

export function TriageActions({ submission }: { submission: Submission }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState(submission.triageNote ?? "");
  const [showResearch, setShowResearch] = useState(false);

  async function update(status: SubmissionStatus) {
    setBusy(status);
    try {
      await fetch(`/api/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, triageNote: note || undefined }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveNote() {
    setBusy("note");
    try {
      await fetch(`/api/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triageNote: note }),
      });
      router.refresh();
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
        placeholder="Internal triage note (never shown publicly)"
        className="field text-[0.8rem]"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={saveNote} disabled={busy !== null} className="btn-ghost border border-rule">
          {busy === "note" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          Save note
        </button>
        {STATUSES.filter((s) => s !== submission.status).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => update(status)}
            disabled={busy !== null}
            className="border border-rule px-2.5 py-1.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft hover:border-navy hover:text-navy"
          >
            {status}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowResearch((v) => !v)}
          className="border border-navy px-2.5 py-1.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper"
        >
          {showResearch ? "Hide research" : "Run research"}
        </button>
      </div>
      {showResearch && (
        <div className="pt-1">
          <ResearchRunner submissionId={submission.id} defaultText={submission.content} compact />
        </div>
      )}
    </div>
  );
}
