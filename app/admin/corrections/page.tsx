import { getStore } from "@/lib/store";
import { CorrectionForm } from "@/components/admin/CorrectionForm";
import { formatDate } from "@/lib/utils";

export default async function AdminCorrectionsPage() {
  const store = getStore();
  const [articles, factChecks, corrections] = await Promise.all([
    store.listArticles({ status: "all", limit: 50 }),
    store.listFactChecks({ status: "all", limit: 50 }),
    store.listCorrections(),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Corrections log</h2>
        <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-muted">
          Corrections are permanent and public. Issuing one attaches a dated notice to the article or report and bumps
          its version.
        </p>

        {corrections.length === 0 ? (
          <p className="mt-5 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-8 text-center font-sans text-[0.85rem] text-ink-muted">
            No corrections issued.
          </p>
        ) : (
          <ol className="mt-5 divide-y divide-rule border-y border-rule">
            {corrections.map((correction) => (
              <li key={correction.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-sans text-[0.58rem] uppercase tracking-[0.12em] text-gold-dark">
                    {correction.severity}
                  </span>
                  <time className="font-sans text-[0.62rem] text-ink-muted" dateTime={correction.date}>
                    {formatDate(correction.date)}
                  </time>
                </div>
                <p className="mt-1 font-sans text-[0.85rem] leading-snug text-ink">{correction.summaryEn}</p>
                {correction.detailEn && (
                  <p className="mt-0.5 font-sans text-[0.76rem] leading-relaxed text-ink-muted">
                    {correction.detailEn}
                  </p>
                )}
                <p className="mt-1 font-sans text-[0.62rem] text-ink-muted">Issued by {correction.issuedBy}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="lg:col-span-5">
        <CorrectionForm
          articles={articles.items.map((a) => ({ id: a.id, title: a.title }))}
          factChecks={factChecks.items.map((f) => ({ id: f.id, headlineEn: f.headlineEn }))}
        />
      </div>
    </div>
  );
}
