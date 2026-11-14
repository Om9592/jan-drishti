import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ShieldAlert, TriangleAlert } from "lucide-react";
import { listPublicChecks } from "@/lib/services/public-checks";
import { getViewer } from "@/lib/security/auth";
import { VERDICT_META, formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Verdict } from "@/lib/types";

export const metadata: Metadata = {
  title: "AI answers to the public",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The desk's record of every machine answer the public received.
 *
 * Read-only on purpose: these answers are already in front of readers, so what
 * an editor needs is not a publish button but the ability to see what the site
 * said, on what evidence, and where the cross-check disagreed.
 */
export default async function AiChecksPage() {
  // The layout renders the "no access" panel, but a layout and a page render in
  // parallel: without this guard the page body still runs, and its output is
  // serialised into the stream even when it is not shown. Never fetch for a
  // stranger — check the role first, then read.
  const viewer = await getViewer();
  if (!viewer || !["admin", "editor", "researcher"].includes(viewer.role)) return null;

  const checks = await listPublicChecks(100);

  const flagged = checks.filter((check) => check.flags.some((flag) => flag !== "unverified"));
  const today = checks.filter((check) => check.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
        <div>
          <h2 className="font-serif text-[1.3rem] text-navy">AI answers given to the public</h2>
          <p className="mt-1 max-w-2xl font-sans text-[0.75rem] leading-relaxed text-ink-soft">
            Every self-serve check the site answered, with the sources it used and where its own models
            disagreed. Nothing here is published — readers saw a machine answer, and this is the record.
          </p>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="font-sans text-[0.55rem] uppercase tracking-[0.1em] text-ink-muted">Total</p>
            <p className="font-serif text-[1.3rem] text-navy">{checks.length}</p>
          </div>
          <div>
            <p className="font-sans text-[0.55rem] uppercase tracking-[0.1em] text-ink-muted">Today</p>
            <p className="font-serif text-[1.3rem] text-navy">{today.length}</p>
          </div>
          <div>
            <p className="font-sans text-[0.55rem] uppercase tracking-[0.1em] text-ink-muted">Needs a look</p>
            <p className="font-serif text-[1.3rem] text-verdict-misleading">{flagged.length}</p>
          </div>
        </div>
      </div>

      {checks.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No self-serve checks yet"
            body="When a reader asks the site to check a claim, the answer they received appears here with its evidence."
          />
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {checks.map((check) => {
            const meta = VERDICT_META[check.verdict as Verdict];
            const needsLook = check.flags.some((flag) => flag !== "unverified");
            return (
              <li key={check.id} className="border border-rule bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="max-w-3xl font-serif text-[0.98rem] leading-snug text-navy">{check.claim}</p>
                  <span className={`border px-2 py-0.5 font-sans text-[0.58rem] uppercase tracking-[0.12em] ${meta?.tone ?? ""}`}>
                    {meta?.en ?? check.verdict} · {check.confidence}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[0.68rem] text-ink-muted">
                  <span>{formatDateTime(check.createdAt)}</span>
                  <span>
                    {check.evidenceChecked} evidence item(s) · {check.publishers} publisher(s)
                  </span>
                  <span>{Math.round(check.durationMs / 1000)}s</span>
                  <span className="inline-flex items-center gap-1">
                    <Bot className="h-3 w-3" aria-hidden="true" />
                    {check.model ?? "no model"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {check.analysts.map((analyst) => (
                    <span
                      key={`${check.id}-${analyst.provider}-${analyst.model}`}
                      className={`border px-1.5 py-0.5 font-sans text-[0.62rem] ${
                        analyst.agrees ? "border-rule text-ink-soft" : "border-verdict-false/40 text-verdict-false"
                      }`}
                    >
                      {analyst.provider} · {analyst.model} → {analyst.verdict}
                      {analyst.agrees ? "" : " (dissented)"}
                    </span>
                  ))}
                  {check.flags.length > 0 && (
                    <span className="inline-flex items-center gap-1 font-sans text-[0.62rem] text-ink-muted">
                      {needsLook ? (
                        <TriangleAlert className="h-3 w-3 text-verdict-misleading" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      )}
                      {check.flags.join(", ")}
                    </span>
                  )}
                </div>

                <p className="mt-2 font-sans text-[0.66rem] leading-relaxed text-ink-muted">Re-check: {check.reCheck}</p>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-5 border-t border-rule pt-3 font-sans text-[0.7rem] leading-relaxed text-ink-muted">
        Machine answers are not editorial verdicts. If one of these deserves a published fact-check, create it from{" "}
        <Link href="/admin/fact-checks" className="underline decoration-rule underline-offset-2 hover:decoration-navy">
          the fact-check desk
        </Link>{" "}
        so a named editor signs the verdict.
      </p>
    </div>
  );
}
