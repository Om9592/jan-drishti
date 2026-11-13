import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ArrowUpRight, ShieldCheck, FileSearch, Clock3 } from "lucide-react";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { FactCheckCard } from "@/components/ui/FactCheckCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { NewsletterForm } from "@/components/ui/NewsletterForm";
import { formatDate, truncate } from "@/lib/utils";

export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const store = getStore();

  const [topStories, latest, underreported, groundReports, factChecks, corrections, categories, stats] =
    await Promise.all([
      store.listArticles({ status: "published", limit: 8, sort: "latest" }),
      store.listArticles({ status: "published", limit: 7, sort: "latest" }),
      store.listArticles({ status: "published", underreportedOnly: true, limit: 4 }),
      store.listArticles({ status: "published", groundReportOnly: true, limit: 4 }),
      store.listFactChecks({ status: "published", limit: 4 }),
      store.listCorrections(),
      store.listCategories(),
      store.getStats(),
    ]);

  const [lead, ...rest] = topStories.items;
  const secondary = rest.slice(0, 2);
  const compact = rest.slice(2, 6);
  const todaysCheck = factChecks.items[0];
  const categoryCounts = await Promise.all(
    categories.slice(0, 8).map(async (category) => {
      const result = await store.listArticles({ status: "published", categorySlug: category.slug, limit: 1 });
      return { category, count: result.total };
    }),
  );

  return (
    <>
      {/* ============================= HERO ============================= */}
      <section className="border-b border-rule bg-paper">
        <div className="container-editorial grid gap-10 py-10 lg:grid-cols-12 lg:gap-12 lg:py-14">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold" aria-hidden="true" />
              <p className="kicker-gold">
                {lang === "hi" ? "स्वतंत्र भारतीय पत्रकारिता" : "Independent Indian journalism"}
              </p>
            </div>

            <h1 className="mt-5 font-serif text-display-xl font-semibold text-navy">
              {t("hero.title")}
            </h1>

            <p className="mt-5 max-w-xl font-serif text-[1.15rem] leading-relaxed text-ink-soft sm:text-[1.3rem]">
              {t("hero.subtitle")}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/fact-check" className="btn-gold">
                <FileSearch className="h-4 w-4" aria-hidden="true" />
                {t("hero.cta")}
              </Link>
              <Link
                href="/fact-checking-methodology"
                className="group inline-flex items-center gap-1.5 font-sans text-[0.72rem] uppercase tracking-[0.12em] text-navy hover:text-gold-dark"
              >
                {t("hero.secondary")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 ease-editorial group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>

            <dl className="mt-9 grid max-w-lg grid-cols-3 divide-x divide-rule border-y border-rule py-4">
              <div className="pr-4">
                <dt className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted">
                  {t("hero.stat.claims")}
                </dt>
                <dd className="mt-1 font-serif text-[1.45rem] text-navy">
                  {stats.openSubmissions + stats.publishedFactChecks}
                </dd>
              </div>
              <div className="px-4">
                <dt className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted">
                  {t("hero.stat.published")}
                </dt>
                <dd className="mt-1 font-serif text-[1.45rem] text-navy">{stats.publishedFactChecks}</dd>
              </div>
              <div className="pl-4">
                <dt className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted">
                  {t("hero.stat.corrections")}
                </dt>
                <dd className="mt-1 font-serif text-[1.45rem] text-navy">{corrections.length}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-center gap-1.5 font-sans text-[0.68rem] text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-gold-dark" aria-hidden="true" />
              {t("hero.heroNote")}
            </p>
          </div>

          {/* Fact check panel */}
          <div className="lg:col-span-5">
            <div className="relative flex h-full flex-col bg-navy px-6 py-6 text-paper sm:px-7">
              <div className="flex items-center justify-between">
                <p className="font-sans text-[0.6rem] uppercase tracking-[0.18em] text-gold">
                  {t("hero.verdictLabel")}
                </p>
                <span className="font-sans text-[0.58rem] uppercase tracking-[0.14em] text-paper/45">
                  {formatDate(new Date().toISOString(), lang, { day: "numeric", month: "long" })}
                </span>
              </div>

              {todaysCheck ? (
                <div className="mt-5 flex-1">
                  <FactCheckCard factCheck={todaysCheck} lang={lang} variant="panel" />
                </div>
              ) : (
                <div className="mt-6">
                  <p className="font-serif text-[1.2rem] leading-snug text-paper/85">{t("hero.noVerdict")}</p>
                  <p className="mt-2 font-sans text-[0.8rem] leading-relaxed text-paper/60">
                    {t("empty.factChecksBody")}
                  </p>
                  <ol className="mt-7 space-y-3 border-t border-paper/20 pt-5">
                    {(lang === "hi"
                      ? [
                          "दावा और उसका स्रोत दर्ज करें",
                          "सरकारी रिकॉर्ड, अदालती आदेश और मूल दस्तावेज़ खोजें",
                          "दोनों पक्षों का प्रमाण लगाएँ, फिर संपादक निर्णय दें",
                        ]
                      : [
                          "Record the claim and where it came from",
                          "Pull government records, court orders and primary documents",
                          "Weigh evidence for both sides, then a named editor decides",
                        ]
                    ).map((step, index) => (
                      <li key={step} className="flex gap-3 font-sans text-[0.82rem] leading-snug text-paper/70">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 font-sans text-[0.6rem] tracking-[0.1em] text-gold"
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="mt-auto border-t border-paper/20 pt-4">
                <Link
                  href="/submit"
                  className="group flex items-center justify-between gap-3 text-paper/85 transition-colors hover:text-gold"
                >
                  <span className="font-sans text-[0.7rem] uppercase tracking-[0.12em]">
                    {t("factCheck.formHeading")}
                  </span>
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-200 ease-editorial group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= TOP STORIES ============================= */}
      <section className="container-editorial py-10">
        <SectionHeading
          title={t("home.topStories")}
          href="/latest"
          linkLabel={t("home.seeAll")}
          description={
            lang === "hi"
              ? "हर ख़बर के साथ उसका स्रोत, तिथि और प्रमाण।"
              : "Every story carries its source, its date and its evidence."
          }
        />

        {lead ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <ArticleCard article={lead} lang={lang} variant="lead" />
            </div>

            <div className="lg:col-span-5">
              <div className="space-y-5">
                {secondary.map((article) => (
                  <ArticleCard key={article.id} article={article} lang={lang} variant="secondary" />
                ))}
              </div>

              {compact.length > 0 && (
                <div className="mt-7 border-t-2 border-navy pt-3">
                  <p className="kicker mb-2">{lang === "hi" ? "अन्य शीर्षक" : "More headlines"}</p>
                  <div>
                    {compact.map((article) => (
                      <ArticleCard key={article.id} article={article} lang={lang} variant="compact" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            className="mt-6"
            title={t("empty.articles")}
            body={t("empty.articlesBody")}
            action={{ href: "/fact-check", label: t("hero.cta") }}
          />
        )}
      </section>

      {/* ============================= LATEST + RAIL ============================= */}
      <section className="border-y border-rule bg-white">
        <div className="container-editorial grid gap-10 py-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-8">
            <SectionHeading title={t("home.latest")} href="/latest" linkLabel={t("home.seeAll")} />
            <div className="mt-6 space-y-6">
              {latest.items.slice(0, 5).map((article) => (
                <ArticleCard key={article.id} article={article} lang={lang} variant="wide" />
              ))}
              {latest.items.length === 0 && (
                <EmptyState title={t("empty.articles")} body={t("empty.articlesBody")} />
              )}
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="space-y-8 lg:sticky lg:top-16">
              <div>
                <div className="flex items-baseline justify-between border-t-2 border-navy pt-3">
                  <h2 className="font-serif text-[1.15rem] font-semibold text-navy">
                    {t("home.underreported")}
                  </h2>
                  <Link
                    href="/latest"
                    className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted hover:text-navy"
                  >
                    {t("home.seeAll")}
                  </Link>
                </div>
                <p className="mt-1.5 font-sans text-[0.75rem] leading-relaxed text-ink-muted">
                  {lang === "hi"
                    ? "जिन ख़बरों को कम जगह मिली, पर जिनका असर बड़ा है।"
                    : "Stories with limited coverage and outsized consequence."}
                </p>
                <div className="mt-3 space-y-3">
                  {underreported.items.slice(0, 3).map((article) => (
                    <ArticleCard key={`rail-u-${article.id}`} article={article} lang={lang} variant="rail" />
                  ))}
                  {underreported.items.length === 0 && (
                    <p className="font-sans text-[0.8rem] leading-relaxed text-ink-muted">
                      {t("empty.articles")}
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-rule bg-paper p-5">
                <p className="kicker-gold">{t("home.newsletter.title")}</p>
                <p className="mt-2 font-serif text-[1.05rem] leading-snug text-navy">
                  {t("home.newsletter.body")}
                </p>
                <div className="mt-4">
                  <NewsletterForm />
                </div>
              </div>

              <div className="border-t border-rule pt-4">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-gold-dark" aria-hidden="true" />
                  <p className="kicker">{t("footer.corrections")}</p>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {corrections.slice(0, 3).map((correction) => (
                    <li key={correction.id} className="border-l border-gold/50 pl-2.5">
                      <p className="font-sans text-[0.78rem] leading-snug text-ink-soft">
                        {truncate(correction.summaryEn, 110)}
                      </p>
                      <p className="mt-0.5 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
                        {formatDate(correction.date, lang)}
                      </p>
                    </li>
                  ))}
                  {corrections.length === 0 && (
                    <li className="font-sans text-[0.78rem] text-ink-muted">{t("common.noCorrections")}</li>
                  )}
                </ul>
                <Link
                  href="/corrections"
                  className="mt-3 inline-block border-b border-gold pb-0.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
                >
                  {t("footer.corrections")}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ============================= UNDERREPORTED ============================= */}
      <section className="bg-paper-warm">
        <div className="container-editorial py-10">
          <div className="flex flex-col gap-2 border-t-2 border-gold pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="kicker-gold">{lang === "hi" ? "कम कवरेज, ज़्यादा मायने" : "Less coverage, more consequence"}</p>
              <h2 className="mt-1.5 font-serif text-[1.6rem] font-semibold text-navy sm:text-[1.9rem]">
                {t("home.underreported")}
              </h2>
            </div>
            <p className="max-w-md font-sans text-[0.8rem] leading-relaxed text-ink-muted">
              {lang === "hi"
                ? "ऐसी जनहित की ख़बरें जिन्हें पर्याप्त कवरेज नहीं मिली — लेकिन जिनका असर सबसे ज़्यादा है।"
                : "Public-interest stories that received limited coverage, chosen because their consequences are large."}
            </p>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {underreported.items.map((article) => (
              <ArticleCard key={article.id} article={article} lang={lang} variant="feature" showImage />
            ))}
            {underreported.items.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <EmptyState title={t("empty.articles")} body={t("empty.articlesBody")} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================= FACT CHECK DESK ============================= */}
      <section className="container-editorial py-10">
        <SectionHeading
          title={t("nav.factCheck")}
          href="/fact-check"
          linkLabel={t("home.seeAll")}
          description={t("factCheck.lede")}
        />
        <div className="mt-6 grid gap-8 lg:grid-cols-12">
          <div className="grid gap-6 sm:grid-cols-3 lg:col-span-8">
            {factChecks.items.slice(0, 3).map((fc) => (
              <FactCheckCard key={fc.id} factCheck={fc} lang={lang} />
            ))}
            {factChecks.items.length === 0 && (
              <div className="sm:col-span-3">
                <EmptyState title={t("empty.factChecks")} body={t("empty.factChecksBody")} />
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="border border-rule bg-paper p-6">
              <p className="kicker-gold">{t("factCheck.howItWorks")}</p>
              <ol className="mt-4 space-y-3.5">
                {[t("factCheck.step1"), t("factCheck.step2"), t("factCheck.step3"), t("factCheck.step4")].map(
                  (step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-navy/30 font-sans text-[0.6rem] text-navy">
                        {index + 1}
                      </span>
                      <span className="font-sans text-[0.8rem] leading-relaxed text-ink-soft">{step}</span>
                    </li>
                  ),
                )}
              </ol>
              <Link href="/submit" className="btn-primary mt-5 w-full">
                {t("factCheck.form.submit")}
              </Link>
              <p className="mt-3 text-center font-sans text-[0.65rem] text-ink-muted">
                {t("factCheck.standards")} · <Link href="/fact-checking-methodology" className="underline decoration-gold underline-offset-2">{t("footer.methodology")}</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= GROUND REPORTS ============================= */}
      {groundReports.items.length > 0 && (
        <section className="border-t border-rule bg-white">
          <div className="container-editorial py-10">
            <SectionHeading title={t("home.groundReports")} href="/ground-reports" linkLabel={t("home.seeAll")} />
            <div className="mt-6 grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <ArticleCard article={groundReports.items[0]!} lang={lang} variant="lead" />
              </div>
              <div className="lg:col-span-6">
                <div className="space-y-4">
                  {groundReports.items.slice(1).map((article) => (
                    <ArticleCard key={article.id} article={article} lang={lang} variant="secondary" />
                  ))}
                  <div className="border-t border-rule pt-4">
                    <p className="kicker mb-2">{lang === "hi" ? "अन्य सेक्शन" : "Elsewhere on Jan Drishti"}</p>
                    {latest.items.slice(0, 3).map((article) => (
                      <ArticleCard key={`rail-${article.id}`} article={article} lang={lang} variant="compact" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================= SECTIONS ============================= */}
      <section className="border-t border-rule">
        <div className="container-editorial py-10">
          <SectionHeading title={t("home.categories")} />
          <ul className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {categoryCounts.map(({ category, count }) => (
              <li key={category.id} className="border-b border-rule">
                <Link
                  href={`/${category.slug}`}
                  className="group flex items-baseline justify-between gap-3 py-3"
                >
                  <span className="font-serif text-[1.05rem] text-navy group-hover:text-gold-dark">
                    {lang === "hi" ? category.nameHi : category.nameEn}
                  </span>
                  <span className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                    {count} {count === 1 ? "story" : "stories"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================= CLOSING BAND ============================= */}
      <section className="bg-navy">
        <div className="container-editorial grid gap-8 py-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <p className="font-sans text-[0.6rem] uppercase tracking-[0.18em] text-gold">
              {lang === "hi" ? "हमारा वादा" : "Our promise"}
            </p>
            <h2 className="mt-3 font-serif text-[1.7rem] leading-tight text-paper sm:text-[2.1rem]">
              {lang === "hi"
                ? "सच बताना आसान नहीं है। इसीलिए हम हर दावे के साथ प्रमाण रखते हैं।"
                : "Truth is harder than noise. That is why every claim we publish carries its evidence."}
            </h2>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {[
                { href: "/editorial-policy", label: t("footer.policy") },
                { href: "/fact-checking-methodology", label: t("footer.methodology") },
                { href: "/corrections", label: t("footer.corrections") },
                { href: "/funding", label: t("footer.funding") },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border-b border-paper/30 pb-0.5 font-sans text-[0.7rem] uppercase tracking-[0.1em] text-paper/80 hover:border-gold hover:text-gold"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="flex items-start gap-3 border border-paper/20 p-5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
              <div>
                <p className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-paper">
                  {lang === "hi" ? "मानव-सत्यापित" : "Human-verified verdicts"}
                </p>
                <p className="mt-1.5 font-sans text-[0.8rem] leading-relaxed text-paper/65">
                  {t("footer.aiNote")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
