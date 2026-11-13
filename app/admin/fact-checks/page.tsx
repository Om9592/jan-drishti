import Link from "next/link";
import { getStore } from "@/lib/store";
import { ResearchRunner } from "@/components/admin/ResearchRunner";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { timeAgo } from "@/lib/utils";

export default async function AdminFactChecksPage() {
  const store = getStore();
  const [all, submissions] = await Promise.all([
    store.listFactChecks({ status: "all", limit: 50 }),
    store.listSubmissions("all"),
  ]);

  const queue = all.items.filter((f) => f.status !== "published" && f.status !== "rejected");
  const published = all.items.filter((f) => f.status === "published");
  const pendingSubmissions = submissions.filter((s) => s.status === "received");

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Fact-check review queue</h2>
          <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-muted">
            Machine research is preliminary. Only an editor or admin can approve a verdict, and the approving
            editor&apos;s name is published with it.
          </p>

          {queue.length === 0 ? (
            <p className="mt-5 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-8 text-center font-sans text-[0.85rem] text-ink-muted">
              No files awaiting review. Run research on a submission to create one.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-rule border-y border-rule">
              {queue.map((fc) => (
                <li key={fc.id} className="py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <VerdictBadge verdict={fc.verdict} size="sm" />
                    <span className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-gold-dark">
                      {fc.status}
                    </span>
                    <span className="font-sans text-[0.62rem] text-ink-muted">{timeAgo(fc.updatedAt)}</span>
                  </div>
                  <Link
                    href={`/admin/fact-checks/${fc.id}`}
                    className="mt-1.5 block font-serif text-[1rem] leading-snug text-navy hover:text-gold-dark"
                  >
                    {fc.headlineEn}
                  </Link>
                  <p className="mt-1 line-clamp-2 font-sans text-[0.75rem] leading-relaxed text-ink-muted">
                    {fc.claimText}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 font-sans text-[0.65rem] text-ink-muted">
                    <span>{fc.supportingEvidence.length} supporting</span>
                    <span>{fc.contradictingEvidence.length} contradicting</span>
                    <span>{fc.importantContext.length} context</span>
                    <span>{fc.research?.aiConfigured ? "AI-assisted" : "manual file"}</span>
                    <Link
                      href={`/admin/fact-checks/${fc.id}`}
                      className="ml-auto border border-navy px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper"
                    >
                      Review & decide
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-9 font-serif text-[1.2rem] font-semibold text-navy">Published verdicts</h2>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {published.length === 0 && (
              <li className="py-3 font-sans text-[0.8rem] text-ink-muted">No published verdicts yet.</li>
            )}
            {published.map((fc) => (
              <li key={fc.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/fact-checks/${fc.id}`} className="min-w-0">
                  <span className="line-clamp-1 font-sans text-[0.82rem] text-navy hover:text-gold-dark">
                    {fc.headlineEn}
                  </span>
                  <span className="font-sans text-[0.6rem] uppercase tracking-[0.08em] text-ink-muted">
                    {fc.reviewerName ?? "unassigned"} · {timeAgo(fc.publishedAt)}
                  </span>
                </Link>
                <VerdictBadge verdict={fc.verdict} size="sm" withIcon={false} />
              </li>
            ))}
          </ul>
        </div>

        <aside className="space-y-4 lg:col-span-5">
          <ResearchRunner />

          <div className="border border-rule bg-white p-4">
            <h3 className="font-serif text-[1.05rem] text-navy">Submissions awaiting triage</h3>
            {pendingSubmissions.length === 0 ? (
              <p className="mt-2 font-sans text-[0.78rem] text-ink-muted">Nothing new.</p>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {pendingSubmissions.slice(0, 5).map((s) => (
                  <li key={s.id} className="border-l border-rule pl-2.5">
                    <p className="line-clamp-2 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                      {s.content}
                    </p>
                    <Link
                      href="/admin/submissions"
                      className="mt-0.5 inline-block font-sans text-[0.6rem] uppercase tracking-[0.1em] text-navy underline decoration-gold underline-offset-2"
                    >
                      Triage
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border border-rule bg-paper p-4">
            <h3 className="font-kicker text-[0.62rem] uppercase tracking-[0.14em] text-ink-muted">
              Editorial rules
            </h3>
            <ul className="mt-2 space-y-1.5 font-sans text-[0.74rem] leading-relaxed text-ink-soft">
              <li>· No verdict without at least one openable source.</li>
              <li>· Insufficient evidence means UNVERIFIED, not FALSE.</li>
              <li>· Publish supporting and contradicting evidence together.</li>
              <li>· Never publish a machine-written verdict.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
