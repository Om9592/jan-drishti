import { getStore } from "@/lib/store";
import { SourceControls } from "@/components/admin/SourceControls";

export default async function AdminTaxonomyPage() {
  const store = getStore();
  const [sources, categories] = await Promise.all([store.listSources(), store.listCategories()]);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h2 className="font-serif text-[1.3rem] font-semibold text-navy">News sources &amp; ingestion</h2>
        <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-muted">
          Feeds are disabled by default. Ingestion respects robots.txt, stores only headline + short attributed
          summary + canonical link, and files everything into review — never straight to publication.
        </p>

        <ul className="mt-5 space-y-3">
          {sources.map((source) => (
            <li key={source.id} className="border border-rule bg-white p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-[1rem] text-navy">{source.name}</p>
                  <p className="mt-0.5 font-sans text-[0.68rem] text-ink-muted">
                    {source.publisher} · {source.type.replace(/_/g, " ")} · {source.language.toUpperCase()}
                  </p>
                </div>
                <span
                  className={`border px-1.5 py-0.5 font-sans text-[0.55rem] uppercase tracking-[0.1em] ${
                    source.enabled
                      ? "border-verdict-true/40 text-verdict-true"
                      : "border-rule text-ink-muted"
                  }`}
                >
                  {source.enabled ? "enabled" : "disabled"}
                </span>
              </div>
              <p className="mt-1.5 break-all font-sans text-[0.68rem] text-ink-muted">{source.url}</p>
              {source.notes && (
                <p className="mt-1 font-sans text-[0.7rem] leading-relaxed text-ink-soft">{source.notes}</p>
              )}
              <div className="mt-2.5">
                <SourceControls source={source} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-5">
        <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Sections</h2>
        <p className="mt-1 font-sans text-[0.78rem] text-ink-muted">
          Sections map to routes. Names render in both languages.
        </p>
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="font-serif text-[0.95rem] text-navy">{category.nameEn}</p>
                <p className="font-sans text-[0.7rem] text-ink-muted">{category.nameHi}</p>
              </div>
              <code className="font-mono text-[0.65rem] text-ink-muted">/{category.slug}</code>
            </li>
          ))}
        </ul>

        <div className="mt-6 border border-rule bg-paper p-4">
          <p className="font-sans text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted">Scheduled ingestion</p>
          <p className="mt-2 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
            A cron endpoint runs enabled feeds: <code className="font-mono text-[0.72rem]">/api/cron/ingest</code>,
            protected by the <code className="font-mono text-[0.72rem]">CRON_SECRET</code> bearer token. The schedule is
            declared in <code className="font-mono text-[0.72rem]">vercel.json</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
