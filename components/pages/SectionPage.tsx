import Link from "next/link";
import { cookies } from "next/headers";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { SAMPLE_STATES } from "@/lib/content/sample";
import { cn } from "@/lib/utils";
import type { Article, Category } from "@/lib/types";

const PER_PAGE = 10;

export interface SectionPageProps {
  title: string;
  kicker: string;
  description: string;
  categorySlug?: string;
  showStateFilter?: boolean;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  emptyTitle?: string;
  emptyBody?: string;
}

function buildQuery(
  base: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === "string" && value && !(key in overrides)) params.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function SectionPage({
  title,
  kicker,
  description,
  categorySlug,
  showStateFilter,
  basePath,
  searchParams,
  emptyTitle,
  emptyBody,
}: SectionPageProps) {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const store = getStore();

  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const language = typeof searchParams.language === "string" ? searchParams.language : "all";
  const state = typeof searchParams.state === "string" ? searchParams.state : "";
  const sort = searchParams.sort === "oldest" ? "oldest" : "latest";

  const result = await store.listArticles({
    status: "published",
    categorySlug,
    page,
    perPage: PER_PAGE,
    language: language === "hi" ? "hi" : language === "en" ? "en" : "all",
    state: state || null,
    sort,
  });

  const categories: Category[] = await store.listCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const [lead, ...others] = result.items;

  const states = Array.from(
    new Set([...SAMPLE_STATES, ...result.items.map((a: Article) => a.state).filter(Boolean)]),
  ) as string[];

  return (
    <div className="container-editorial py-8 sm:py-10">
      <header className="border-b border-rule pb-6">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gold" aria-hidden="true" />
          <p className="kicker-gold">{kicker}</p>
        </div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-serif text-display-md font-semibold text-navy">{title}</h1>
            <p className="mt-2 max-w-2xl font-sans text-[0.92rem] leading-relaxed text-ink-soft">{description}</p>
          </div>
          <p className="shrink-0 font-sans text-[0.65rem] uppercase tracking-[0.12em] text-ink-muted">
            {result.total} {result.total === 1 ? "report" : "reports"}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-3">
          <FilterBar
            label={t("search.language")}
            active={language}
            buildHref={(value) => `${basePath}${buildQuery(searchParams, { language: value === "all" ? undefined : value, page: undefined })}`}
            options={[
              { value: "all", label: t("common.all") },
              { value: "en", label: "English" },
              { value: "hi", label: "हिन्दी" },
            ]}
          />
          <FilterBar
            label={t("search.sort")}
            active={sort}
            buildHref={(value) => `${basePath}${buildQuery(searchParams, { sort: value === "latest" ? undefined : value, page: undefined })}`}
            options={[
              { value: "latest", label: t("search.sort.latest") },
              { value: "oldest", label: t("search.sort.oldest") },
            ]}
          />
          {showStateFilter && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="mr-1 font-sans text-[0.6rem] uppercase tracking-[0.14em] text-ink-muted">
                {t("search.state")}
              </span>
              <Link
                href={`${basePath}${buildQuery(searchParams, { state: undefined, page: undefined })}`}
                className={cn(
                  "border px-2.5 py-1 font-sans text-[0.66rem] uppercase tracking-[0.08em]",
                  !state ? "border-navy bg-navy text-paper" : "border-rule text-ink-soft hover:border-navy hover:text-navy",
                )}
              >
                {t("common.all")}
              </Link>
              <details className="relative">
                <summary className="cursor-pointer border border-rule px-2.5 py-1 font-sans text-[0.66rem] uppercase tracking-[0.08em] text-ink-soft hover:border-navy hover:text-navy">
                  {state || "Select state"}
                </summary>
                <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto border border-rule bg-white p-1 shadow-lift">
                  {states.map((s) => (
                    <Link
                      key={s}
                      href={`${basePath}${buildQuery(searchParams, { state: s, page: undefined })}`}
                      className={cn(
                        "block px-2 py-1.5 font-sans text-[0.78rem] hover:bg-paper-warm",
                        state === s ? "bg-paper-warm text-navy" : "text-ink-soft",
                      )}
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={emptyTitle ?? t("empty.articles")}
          body={emptyBody ?? t("empty.articlesBody")}
          action={{ href: "/fact-check", label: t("hero.cta") }}
        />
      ) : (
        <>
          {page === 1 && lead && (
            <div className="mt-8 grid gap-8 border-b border-rule pb-8 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-7">
                <ArticleCard article={lead} lang={lang} variant="lead" />
              </div>
              <div className="lg:col-span-5">
                <div className="space-y-5">
                  {others.slice(0, 3).map((article) => (
                    <ArticleCard key={article.id} article={article} lang={lang} variant="secondary" />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <SectionHeading
              title={page === 1 && lead ? t("common.moreIn") + " " + title : title}
              className="mb-5"
            />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {(page === 1 && lead ? others.slice(3) : result.items).map((article) => (
                <ArticleCard key={article.id} article={article} lang={lang} variant="standard" />
              ))}
            </div>
          </div>

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(result.total / PER_PAGE))}
            lang={lang}
            buildHref={(p) => `${basePath}${buildQuery(searchParams, { page: String(p) })}`}
          />
        </>
      )}

      {category?.descriptionEn && lang === "en" && (
        <p className="mt-10 border-t border-rule pt-4 font-sans text-[0.75rem] text-ink-muted">
          {category.descriptionEn}
        </p>
      )}
    </div>
  );
}
