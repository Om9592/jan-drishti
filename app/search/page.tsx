import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Search as SearchIcon } from "lucide-react";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { FactCheckCard } from "@/components/ui/FactCheckCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SAMPLE_STATES } from "@/lib/content/sample";
import type { DateRange } from "@/lib/store/types";

export const metadata: Metadata = {
  title: "Search",
  description: "Search Jan Drishti reporting, fact checks and sources by keyword, section, state, language and date.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

const PER_PAGE = 8;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const store = getStore();

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const type = typeof params.type === "string" ? params.type : "all";
  const category = typeof params.category === "string" ? params.category : "";
  const state = typeof params.state === "string" ? params.state : "";
  const language = typeof params.language === "string" ? params.language : "all";
  const date = (typeof params.date === "string" ? params.date : "any") as DateRange;
  const sort = params.sort === "oldest" ? "oldest" : "latest";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const categories = await store.listCategories();

  const [articleResults, factResults] = await Promise.all([
    type === "fact-checks"
      ? Promise.resolve({ items: [], total: 0 })
      : store.listArticles({
          q: q || undefined,
          status: "published",
          categorySlug: category || undefined,
          state: state || null,
          language: language === "hi" ? "hi" : language === "en" ? "en" : "all",
          dateRange: date,
          sort,
          perPage: PER_PAGE,
          page,
        }),
    type === "reporting"
      ? Promise.resolve({ items: [], total: 0 })
      : store.listFactChecks({
          q: q || undefined,
          status: "published",
          dateRange: date,
          sort,
          perPage: PER_PAGE,
          page,
        }),
  ]);

  const total = articleResults.total + factResults.total;

  function buildHref(overrides: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    const base: Record<string, string> = {
      q,
      type,
      category,
      state,
      language,
      date,
      sort,
      page: String(page),
    };
    for (const [key, value] of Object.entries({ ...base, ...overrides })) {
      if (!value) continue;
      if (key === "q" && !value) continue;
      if ((key === "type" && value === "all") || (key === "language" && value === "all")) continue;
      if (key === "date" && value === "any") continue;
      if (key === "sort" && value === "latest") continue;
      if (key === "page" && value === "1") continue;
      next.set(key, value);
    }
    const qs = next.toString();
    return `/search${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="container-editorial py-9">
      <header>
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gold" aria-hidden="true" />
          <p className="kicker-gold">{t("search.title")}</p>
        </div>
        <h1 className="mt-3 font-serif text-display-md font-semibold text-navy">
          {q ? (
            <>
              {t("search.results")} <span className="text-gold-dark">{t("search.resultsFor")}</span> “{q}”
            </>
          ) : (
            t("search.title")
          )}
        </h1>

        <form action="/search" method="get" className="mt-5 flex max-w-2xl items-stretch" role="search">
          <label htmlFor="q" className="sr-only">
            {t("search.placeholder")}
          </label>
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder={t("search.placeholder")}
              className="field pl-9"
              type="search"
            />
          </div>
          <button type="submit" className="btn-primary ml-2 shrink-0">
            {t("search.title")}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-rule py-3">
          <FilterBar
            label={t("search.type")}
            active={type}
            buildHref={(value) => buildHref({ type: value, page: "1" })}
            options={[
              { value: "all", label: t("search.type.all") },
              { value: "reporting", label: t("search.type.articles") },
              { value: "fact-checks", label: t("search.type.factChecks") },
            ]}
          />
          <FilterBar
            label={t("search.language")}
            active={language}
            buildHref={(value) => buildHref({ language: value, page: "1" })}
            options={[
              { value: "all", label: t("common.all") },
              { value: "en", label: "English" },
              { value: "hi", label: "हिन्दी" },
            ]}
          />
          <FilterBar
            label={t("search.date")}
            active={date}
            buildHref={(value) => buildHref({ date: value, page: "1" })}
            options={[
              { value: "any", label: t("search.date.any") },
              { value: "week", label: t("search.date.week") },
              { value: "month", label: t("search.date.month") },
              { value: "year", label: t("search.date.year") },
            ]}
          />
          <FilterBar
            label={t("search.sort")}
            active={sort}
            buildHref={(value) => buildHref({ sort: value, page: "1" })}
            options={[
              { value: "latest", label: t("search.sort.latest") },
              { value: "oldest", label: t("search.sort.oldest") },
            ]}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterBar
            label={t("search.category")}
            active={category || "all"}
            buildHref={(value) => buildHref({ category: value === "all" ? undefined : value, page: "1" })}
            options={[
              { value: "all", label: t("common.all") },
              ...categories.map((c) => ({ value: c.slug, label: lang === "hi" ? c.nameHi : c.nameEn })),
            ]}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="mr-1 font-sans text-[0.6rem] uppercase tracking-[0.14em] text-ink-muted">
            {t("search.state")}
          </span>
          {SAMPLE_STATES.slice(0, 8).map((s) => (
            <a
              key={s}
              href={buildHref({ state: state === s ? undefined : s, page: "1" })}
              className={`border px-2.5 py-1 font-sans text-[0.66rem] uppercase tracking-[0.08em] transition-colors ${
                state === s ? "border-navy bg-navy text-paper" : "border-rule text-ink-soft hover:border-navy hover:text-navy"
              }`}
            >
              {s}
            </a>
          ))}
          {state && (
            <a
              href={buildHref({ state: undefined, page: "1" })}
              className="font-sans text-[0.66rem] uppercase tracking-[0.08em] text-gold-dark underline decoration-gold underline-offset-2"
            >
              {t("common.clear")}
            </a>
          )}
        </div>

        <p className="mt-4 font-sans text-[0.65rem] uppercase tracking-[0.12em] text-ink-muted">
          {total} {t("search.results").toLowerCase()}
        </p>
      </header>

      {total === 0 ? (
        <EmptyState
          className="mt-8"
          title={t("search.empty")}
          body={t("search.emptyHint")}
          action={{ href: "/latest", label: t("nav.latest") }}
        />
      ) : (
        <div className="mt-7 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {articleResults.items.length > 0 && (
              <>
                <h2 className="section-heading font-serif text-[1.2rem] font-semibold text-navy">
                  {t("search.type.articles")}
                </h2>
                <div className="mt-5 space-y-7">
                  {articleResults.items.map((article) => (
                    <ArticleCard key={article.id} article={article} lang={lang} variant="wide" />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-4">
            {factResults.items.length > 0 && (
              <>
                <h2 className="section-heading font-serif text-[1.2rem] font-semibold text-navy">
                  {t("search.type.factChecks")}
                </h2>
                <div className="mt-5">
                  {factResults.items.map((fc) => (
                    <FactCheckCard key={fc.id} factCheck={fc} lang={lang} variant="list" />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
        lang={lang}
        buildHref={(p) => buildHref({ page: String(p) })}
      />
    </div>
  );
}
