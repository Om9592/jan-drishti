"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Power } from "lucide-react";
import type { FeedSource } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function SourceControls({ source }: { source: FeedSource }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function call(body: { enabled?: boolean; run?: boolean }) {
    setBusy(body.run ? "run" : "toggle");
    setResult(null);
    try {
      const res = await fetch("/api/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: source.id, ...body }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        result?: { created: number; duplicates: number; status: string; message?: string };
      };
      if (!res.ok || !data.ok) {
        setResult(data.error ?? "Action failed.");
        return;
      }
      if (data.result) {
        setResult(
          `${data.result.status}: ${data.result.created} new, ${data.result.duplicates} duplicates.${
            data.result.message ? ` ${data.result.message}` : ""
          }`,
        );
      }
      router.refresh();
    } catch {
      setResult("Request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => call({ enabled: !source.enabled })}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 border border-rule px-2.5 py-1.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft hover:border-navy hover:text-navy"
        >
          {busy === "toggle" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" aria-hidden="true" />}
          {source.enabled ? "Disable" : "Enable"}
        </button>
        <button
          type="button"
          onClick={() => call({ run: true })}
          disabled={busy !== null || !source.enabled}
          className="inline-flex items-center gap-1 border border-navy px-2.5 py-1.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper disabled:opacity-40"
        >
          {busy === "run" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" aria-hidden="true" />}
          Fetch now
        </button>
      </div>
      <p className="font-sans text-[0.62rem] text-ink-muted">
        Last fetch: {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : "never"} · status{" "}
        {source.lastStatus ?? "never"}
      </p>
      {result && <p className="font-sans text-[0.68rem] leading-relaxed text-ink-soft">{result}</p>}
    </div>
  );
}
