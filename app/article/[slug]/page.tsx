import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronRight, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { getStore } from "@/lib/store";
import { contributorSlugFor } from "@/lib/services/contributors";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { config } from "@/lib/config";
import { ArticleImage } from "@/components/ui/ArticleImage";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { ProvenanceLabel } from "@/components/ui/ProvenanceLabel";
import { ShareRow } from "@/components/ui/ShareRow";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { CorrectionNotice } from "@/components/article/CorrectionNotice";
import { SourceList } from "@/components/article/SourceList";
import { getViewer } from "@/lib/security/auth";
import { formatDate, formatDateTime, stripHtml, truncate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = getStore();
  const article = await store.getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };

  const description = article.seoDescription ?? truncate(article.summary, 155);
  return {
    title: article.seoTitle ?? article.title,
    description,
    alternates: {
      canonical: `/article/${article.slug}`,
      languages: article.translationGroupId
        ? undefined
        : { en: `/article/${article.slug}` },
    },
    openGraph: {
      type: "article",
      title: article.title,
      description,
      url: `${config.siteUrl}/article/${article.slug}`,
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
      authors: article.authorName ? [article.authorName] : undefined,
      section: article.categorySlug,
      tags: article.tags,
      images: article.imageUrl ? [{ url: article.imageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: article.imageUrl ? [article.imageUrl] : undefined,
    },
    robots: article.isSample ? { index: false, follow: true } : undefined,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const store = getStore();
  const viewer = await getViewer();

  const article = await store.getArticleBySlug(slug);
  if (!article) notFound();

  const related = await store.getRelatedArticles(article, 4);
  const categories = await store.listCategories();
  const category = categories.find((c) => c.id === article.categoryId);
  // A freelance contributor's byline links to their own page of published work.
  const contributorSlug = article.authorId ? await contributorSlugFor(article.authorId) : null;
  const url = `${config.siteUrl}/article/${article.slug}`;
  const corrections = article.corrections ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.seoDescription ?? article.summary,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    articleSection: category?.nameEn,
    inLanguage: article.language === "hi" ? "hi-IN" : "en-IN",
    author: [{ "@type": "Person", name: article.authorName ?? "Jan Drishti Editorial Desk" }],
    publisher: {
      "@type": "NewsMediaOrganisation",
      name: "Jan Drishti",
      url: config.siteUrl,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: article.imageUrl ? [`${config.siteUrl}${article.imageUrl}`] : undefined,
    isAccessibleForFree: true,
  };

  return (
    <article className="pb-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumbs */}
      <div className="border-b border-rule bg-paper-warm/50">
        <div className="container-editorial flex items-center gap-1.5 py-2.5 font-sans text-[0.65rem] uppercase tracking-[0.08em] text-ink-muted">
          <Link href="/" className="hover:text-navy">
            {t("nav.home")}
          </Link>
          <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
          {article.categorySlug && (
            <>
              <Link href={`/${article.categorySlug}`} className="hover:text-navy">
                {category ? (lang === "hi" ? category.nameHi : category.nameEn) : article.categorySlug}
              </Link>
              <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
            </>
          )}
          <span className="truncate normal-case tracking-normal text-ink-muted">{truncate(article.title, 60)}</span>
        </div>
      </div>

      {/* Header */}
      <header className="container-editorial pt-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {article.categorySlug && (
              <Link
                href={`/${article.categorySlug}`}
                className="font-sans text-[0.62rem] uppercase tracking-[0.16em] text-gold-dark hover:text-navy"
              >
                {category ? (lang === "hi" ? category.nameHi : category.nameEn) : article.categorySlug}
              </Link>
            )}
            <span className="h-2.5 w-px bg-rule-strong" aria-hidden="true" />
            <ProvenanceLabel kind={article.kind} lang={lang} />
            {article.isSample && (
              <span className="border border-rule-strong px-1.5 py-px font-sans text-[0.55rem] uppercase tracking-[0.12em] text-ink-muted">
                {t("common.sample")}
              </span>
            )}
          </div>

          <h1 className="mt-3 font-serif text-[2rem] font-semibold leading-[1.1] tracking-[-0.015em] text-navy sm:text-[2.6rem]">
            {article.title}
          </h1>

          {article.subtitle && (
            <p className="mt-4 font-serif text-[1.1rem] leading-relaxed text-ink-soft sm:text-[1.22rem]">
              {article.subtitle}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-rule py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-navy/20 bg-paper-warm font-serif text-[0.8rem] text-navy">
                {(article.authorName ?? "JD")
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div>
                <p className="font-sans text-[0.8rem] font-medium text-ink">
                  {contributorSlug ? (
                    <Link
                      href={`/contributors/${contributorSlug}`}
                      className="underline decoration-rule underline-offset-2 hover:text-gold-dark"
                    >
                      {article.authorName ?? "Jan Drishti Editorial Desk"}
                    </Link>
                  ) : (
                    (article.authorName ?? "Jan Drishti Editorial Desk")
                  )}
                  {contributorSlug && (
                    <span className="ml-2 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-gold-dark">
                      Contributor
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-[0.68rem] text-ink-muted">
                  <time dateTime={article.publishedAt ?? article.updatedAt}>
                    {formatDateTime(article.publishedAt ?? article.updatedAt, lang)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    {article.readingMinutes ?? 4} {t("common.minutes")}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <BookmarkButton articleId={article.id} signedIn={Boolean(viewer?.authenticated)} />
              <ShareRow url={url} title={article.title} />
            </div>
          </div>

          {article.updatedAt && article.publishedAt && article.updatedAt !== article.publishedAt && (
            <p className="mt-2 flex items-center gap-1.5 font-sans text-[0.65rem] text-ink-muted">
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              {t("common.updated")} {formatDateTime(article.updatedAt, lang)}
            </p>
          )}

          {corrections.length > 0 && (
            <div className="mt-5">
              <CorrectionNotice corrections={corrections} lang={lang} title={t("common.corrections")} />
            </div>
          )}
        </div>
      </header>

      {article.imageUrl && (
        <div className="container-editorial mt-7">
          <div className="mx-auto max-w-5xl">
            <ArticleImage
              src={article.imageUrl}
              alt={article.imageCaption ?? article.title}
              caption={article.imageCaption}
              credit={article.imageCredit}
              priority
              ratio="3/2"
              sizes="(max-width: 1024px) 100vw, 1000px"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="container-editorial mt-9">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="article-prose" dangerouslySetInnerHTML={{ __html: article.content }} />

            {article.tags && article.tags.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2 border-t border-rule pt-4">
                {article.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/search?q=${encodeURIComponent(tag)}`}
                      className="border border-rule px-2 py-1 font-sans text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted hover:border-navy hover:text-navy"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 border border-rule bg-paper-warm/50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" aria-hidden="true" />
                <div>
                  <p className="font-sans text-[0.72rem] uppercase tracking-[0.1em] text-navy">
                    {lang === "hi" ? "इस ख़बर में कुछ ग़लत लगा?" : "Something wrong in this story?"}
                  </p>
                  <p className="mt-1 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                    {lang === "hi"
                      ? "सुधार अनुरोध भेजें — लेखक को नहीं, संपादक को। हम 24 घंटे में जवाब देने का प्रयास करते हैं।"
                      : "Send a correction request to the desk, not the reporter. We aim to respond within 24 hours and we log every notice publicly."}
                  </p>
                  <Link
                    href={`/submit?type=correction&ref=${encodeURIComponent(article.slug)}`}
                    className="mt-2 inline-block border-b border-gold pb-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
                  >
                    {lang === "hi" ? "सुधार अनुरोध भेजें" : "Request a correction"}
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
              <ShareRow url={url} title={article.title} />
              <p className="font-sans text-[0.65rem] text-ink-muted">
                {t("common.published")}: {formatDate(article.publishedAt, lang)}
              </p>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="space-y-8 lg:sticky lg:top-16">
              {article.sources && article.sources.length > 0 && (
                <div>
                  <SourceList sources={article.sources} lang={lang} />
                </div>
              )}

              {corrections.length > 0 && (
                <div>
                  <h2 className="kicker border-t border-rule pt-3">{t("common.correctionHistory")}</h2>
                  <ul className="mt-3 space-y-2">
                    {corrections.map((c) => (
                      <li key={c.id} className="font-sans text-[0.75rem] leading-relaxed text-ink-muted">
                        <time dateTime={c.date} className="block text-[0.65rem] uppercase tracking-[0.1em]">
                          {formatDate(c.date, lang)}
                        </time>
                        {c.summaryEn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-rule pt-3">
                <h2 className="kicker mb-3">{t("common.related")}</h2>
                <div className="space-y-3">
                  {related.length === 0 && (
                    <p className="font-sans text-[0.78rem] text-ink-muted">{t("empty.articles")}</p>
                  )}
                  {related.map((item) => (
                    <ArticleCard key={item.id} article={item} lang={lang} variant="rail" />
                  ))}
                </div>
              </div>

              <div className="border border-rule bg-paper p-4">
                <p className="kicker-gold">{t("nav.factCheck")}</p>
                <p className="mt-1.5 font-serif text-[1rem] leading-snug text-navy">{t("factCheck.title")}</p>
                <Link
                  href="/fact-check"
                  className="mt-2 inline-block border-b border-gold pb-0.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
                >
                  {t("hero.cta")}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12 border-t border-rule bg-white">
          <div className="container-editorial py-8">
            <div className="section-heading">
              <h2 className="font-serif text-[1.25rem] font-semibold text-navy">{t("common.related")}</h2>
            </div>
            <div className="mt-5 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <ArticleCard key={`grid-${item.id}`} article={item} lang={lang} variant="secondary" />
              ))}
            </div>
          </div>
        </section>
      )}

      <p className="sr-only">{stripHtml(article.summary)}</p>
    </article>
  );
}
