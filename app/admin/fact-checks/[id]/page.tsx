import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { ReviewForm } from "@/components/admin/ReviewForm";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { SourceTypeLabel } from "@/components/article/SourceList";
import { formatDateTime } from "@/lib/utils";

export default async function AdminFactCheckReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getStore();
  const fc = await store.getFactCheckById(id);
  if (!fc) notFound();

  const allEvidence = [...fc.supportingEvidence, ...fc.contradictingEvidence, ...fc.importantContext];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
        <Link href="/admin/fact-checks" className="font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted hover:text-navy">
          ← Back to queue
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
            status: {fc.status}
          </span>
          <VerdictBadge verdict={fc.verdict} size="sm" />
        </div>
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="border border-rule bg-paper p-4">
            <p className="kicker">The claim (verbatim)</p>
            <p className="mt-1.5 font-serif text-[1.05rem] leading-relaxed text-ink">“{fc.claimText}”</p>
            <p className="mt-2 font-sans text-[0.65rem] text-ink-muted">
              Claim ID {fc.claimId} · language {fc.claimLanguage} · updated {formatDateTime(fc.updatedAt)}
            </p>
          </div>

          <ReviewForm factCheck={fc} />

          <div className="border border-rule bg-white p-4">
            <h3 className="font-serif text-[1.05rem] text-navy">Evidence file ({allEvidence.length})</h3>
            {allEvidence.length === 0 ? (
              <p className="mt-2 font-sans text-[0.8rem] leading-relaxed text-ink-muted">
                No evidence was attached. Without evidence the only defensible verdict is UNVERIFIED. Configure a
                search provider (TAVILY_API_KEY / BRAVE_SEARCH_API_KEY / SERPER_API_KEY) or add sources manually.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {allEvidence.map((item) => (
                  <li key={item.id} className="border-l-2 border-rule pl-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SourceTypeLabel type={item.sourceType} />
                      <span className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                        {item.stance}
                      </span>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-0.5 block font-sans text-[0.85rem] text-navy underline decoration-gold underline-offset-2"
                    >
                      {item.title}
                    </a>
                    <p className="font-sans text-[0.68rem] text-ink-muted">{item.publisher}</p>
                    {item.quote && (
                      <p className="mt-1 font-sans text-[0.76rem] leading-relaxed text-ink-soft">{item.quote}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:col-span-5">
          {fc.research ? (
            <div className="border border-rule bg-white p-4">
              <h3 className="font-serif text-[1.05rem] text-navy">Research report</h3>
              <p className="mt-1 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-gold-dark">
                Preliminary · generated {formatDateTime(fc.research.generatedAt)}
              </p>
              <dl className="mt-3 space-y-2 font-sans text-[0.78rem] text-ink-soft">
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">Recommended verdict</dt>
                  <dd className="font-medium text-navy">
                    {fc.research.preliminaryVerdict} ({fc.research.confidence} confidence)
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">Supporting</dt>
                  <dd>{fc.research.supportingSummaryEn || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">Contradicting</dt>
                  <dd>{fc.research.contradictingSummaryEn || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">Missing context</dt>
                  <dd>{fc.research.missingContextEn || "—"}</dd>
                </div>
              </dl>

              <h4 className="mt-4 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
                Pipeline log
              </h4>
              <ul className="mt-1.5 space-y-1">
                {fc.research.steps.map((step) => (
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
              <p className="mt-3 border-t border-rule pt-2 font-sans text-[0.66rem] leading-relaxed text-ink-muted">
                AI configured: {fc.research.aiConfigured ? "yes" : "no"} · Search configured:{" "}
                {fc.research.searchConfigured ? "yes" : "no"} · Model: {fc.research.model ?? "none"}
              </p>
            </div>
          ) : (
            <div className="border border-rule bg-paper p-4">
              <p className="font-sans text-[0.8rem] leading-relaxed text-ink-muted">
                No research report attached to this file.
              </p>
            </div>
          )}

          <div className="border border-rule bg-white p-4">
            <h3 className="font-serif text-[1.05rem] text-navy">Publication checklist</h3>
            <ul className="mt-2 space-y-1.5 font-sans text-[0.75rem] leading-relaxed text-ink-soft">
              <li>□ Every evidence link opens and supports the sentence it is attached to.</li>
              <li>□ Supporting and contradicting evidence are both published.</li>
              <li>□ Missing context is stated in plain language.</li>
              <li>□ The claim is quoted as it reached the reader.</li>
              <li>□ Confidence matches the strength of the record.</li>
              <li>□ Your name can stand next to the verdict.</li>
            </ul>
          </div>

          {fc.status === "published" && (
            <Link
              href={`/fact-check/${fc.slug}`}
              className="btn-outline w-full"
              target="_blank"
              rel="noreferrer"
            >
              View public report
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
