import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronRight, ExternalLink, Quote, ShieldCheck, FileWarning, Info } from "lucide-react";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { config } from "@/lib/config";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { VerdictMeta } from "@/components/factcheck/VerdictMeta";
import { ShareRow } from "@/components/ui/ShareRow";
import { CorrectionNotice } from "@/components/article/CorrectionNotice";
import { SourceTypeLabel } from "@/components/article/SourceList";
import { FactCheckCard } from "@/components/ui/FactCheckCard";
import { formatDate, truncate, VERDICT_META } from "@/lib/utils";
import type { Evidence } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = getStore();
  const fc = await store.getFactCheckBySlug(slug);
  if (!fc) return { title: "Fact check not found" };

  const description = truncate(fc.explanationEn, 155);
  return {
    title: fc.headlineEn,
    description,
    alternates: { canonical: `/fact-check/${fc.slug}` },
    openGraph: {
      type: "article",
      title: fc.headlineEn,
      description,
      url: `${config.siteUrl}/fact-check/${fc.slug}`,
      publishedTime: fc.publishedAt ?? undefined,
      modifiedTime: fc.updatedAt,
    },
    twitter: { card: "summary_large_image", title: fc.headlineEn, description },
    robots: fc.isSample ? { index: false, follow: true } : undefined,
  };
}

function EvidenceBlock({
  items,
  title,
  emptyText,
  tone,
  lang,
}: {
  items: Evidence[];
  title: string;
  emptyText: string;
  tone: "support" | "contradict" | "context";
  lang: "en" | "hi";
}) {
  const accent =
    tone === "support" ? "border-verdict-true/40" : tone === "contradict" ? "border-verdict-false/40" : "border-gold/50";
  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-serif text-[1.25rem] text-navy">
        <span className={`h-2.5 w-2.5 ${tone === "support" ? "bg-verdict-true" : tone === "contradict" ? "bg-verdict-false" : "bg-gold"}`} aria-hidden="true" />
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 border-l border-rule pl-3 font-sans text-[0.82rem] leading-relaxed text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {items.map((item) => (
            <li key={item.id} className={`border-l-2 ${accent} pl-3.5`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <SourceTypeLabel type={item.sourceType} lang={lang} />
                {item.isPrimary && (
                  <span className="border border-gold/60 px-1 font-sans text-[0.52rem] uppercase tracking-[0.1em] text-gold-dark">
                    {lang === "hi" ? "प्राथमिक" : "Primary"}
                  </span>
                )}
                {item.publishedAt && (
                  <span className="font-sans text-[0.62rem] text-ink-muted">{formatDate(item.publishedAt, lang)}</span>
                )}
              </div>
              <a
                href={item.url}
                target={item.url.startsWith("http") ? "_blank" : undefined}
                rel={item.url.startsWith("http") ? "noopener noreferrer nofollow" : undefined}
                className="mt-1 inline-flex items-start gap-1 font-serif text-[1.02rem] leading-snug text-navy hover:text-gold-dark hover:underline hover:decoration-gold hover:underline-offset-2"
              >
                {item.title}
                {item.url.startsWith("http") && <ExternalLink className="mt-1 h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />}
              </a>
              <p className="mt-0.5 font-sans text-[0.7rem] text-ink-muted">
                {item.publisher}
                {item.retrievedAt && ` · retrieved ${formatDate(item.retrievedAt, lang)}`}
              </p>
              {item.quote && (
                <blockquote className="mt-1.5 border-l border-rule pl-2.5 font-sans text-[0.8rem] leading-relaxed text-ink-soft">
                  {item.quote}
                </blockquote>
              )}
              {item.noteEn && (
                <p className="mt-1.5 font-sans text-[0.78rem] leading-relaxed text-ink-soft">{item.noteEn}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function FactCheckReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const store = getStore();

  const fc = await store.getFactCheckBySlug(slug);
  if (!fc) notFound();

  const more = await store.listFactChecks({ status: "published", limit: 4 });
  const related = more.items.filter((item) => item.id !== fc.id).slice(0, 3);
  const url = `${config.siteUrl}/fact-check/${fc.slug}`;
  const corrections = fc.corrections ?? [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    url,
    claimReviewed: fc.claimText,
    itemReviewed: {
      "@type": "Claim",
      appearance: fc.sourceUrls[0] ?? url,
      firstAppearance: fc.claimFirstSeen ?? undefined,
    },
    author: { "@type": "Organization", name: "Jan Drishti", url: config.siteUrl },
    reviewRating: {
      "@type": "Rating",
      ratingValue: fc.verdict === "verified_true" ? 5 : fc.verdict === "false" ? 1 : 3,
      bestRating: 5,
      worstRating: 1,
      alternateName: VERDICT_META[fc.verdict].en,
    },
    datePublished: fc.publishedAt,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="border-b border-rule bg-paper-warm/50">
        <div className="container-editorial flex items-center gap-1.5 py-2.5 font-sans text-[0.65rem] uppercase tracking-[0.08em] text-ink-muted">
          <Link href="/" className="hover:text-navy">
            {t("nav.home")}
          </Link>
          <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
          <Link href="/fact-check" className="hover:text-navy">
            {t("nav.factCheck")}
          </Link>
          <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
          <span className="truncate normal-case tracking-normal">{truncate(fc.headlineEn, 48)}</span>
        </div>
      </div>

      <header className="border-b border-rule bg-white">
        <div className="container-editorial py-8">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="kicker-gold">{lang === "hi" ? "फ़ैक्ट चेक रिपोर्ट" : "Fact-check report"}</p>
              <span className="h-2.5 w-px bg-rule-strong" aria-hidden="true" />
              <VerdictBadge verdict={fc.verdict} lang={lang} />
              {fc.isSample && (
                <span className="border border-rule-strong px-1.5 py-px font-sans text-[0.55rem] uppercase tracking-[0.12em] text-ink-muted">
                  {t("common.sample")}
                </span>
              )}
            </div>

            <h1 className="mt-3 font-serif text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.015em] text-navy sm:text-[2.4rem]">
              {lang === "hi" && fc.headlineHi ? fc.headlineHi : fc.headlineEn}
            </h1>

            {/* The claim */}
            <div className="mt-6 border border-rule bg-paper px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2">
                <Quote className="h-3.5 w-3.5 text-gold-dark" aria-hidden="true" />
                <p className="kicker">{t("factCheck.claim")}</p>
              </div>
              <p className="mt-2 font-serif text-[1.05rem] leading-relaxed text-ink sm:text-[1.15rem]">
                “{fc.claimText}”
              </p>
              <p className="mt-2 font-sans text-[0.68rem] text-ink-muted">
                {lang === "hi" ? "दावे की भाषा" : "Claim language"}: {fc.claimLanguage === "hi" ? "हिन्दी" : "English"}
                {fc.claimFirstSeen && ` · ${lang === "hi" ? "पहली बार देखा" : "first traced"} ${formatDate(fc.claimFirstSeen, lang)}`}
              </p>
            </div>

            <div className="mt-5">
              <VerdictMeta factCheck={fc} lang={lang} />
            </div>

            {corrections.length > 0 && (
              <div className="mt-5">
                <CorrectionNotice corrections={corrections} lang={lang} />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container-editorial py-9">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <section>
              <h2 className="font-serif text-[1.4rem] text-navy">{t("factCheck.explanation")}</h2>
              <div className="mt-2 space-y-4 font-sans text-[1rem] leading-[1.75] text-ink-soft">
                {(lang === "hi" && fc.explanationHi ? fc.explanationHi : fc.explanationEn)
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-serif text-[1.4rem] text-navy">{t("factCheck.context")}</h2>
              <div className="mt-2 space-y-4 font-sans text-[1rem] leading-[1.75] text-ink-soft">
                {(lang === "hi" && fc.contextHi ? fc.contextHi : fc.contextEn)
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            </section>

            <EvidenceBlock
              items={fc.supportingEvidence}
              title={t("factCheck.supporting")}
              emptyText={
                lang === "hi"
                  ? "इस दावे के समर्थन में कोई स्वतंत्र प्रमाण नहीं मिला।"
                  : "No independent evidence supporting the claim as stated was located."
              }
              tone="support"
              lang={lang}
            />

            <EvidenceBlock
              items={fc.contradictingEvidence}
              title={t("factCheck.contradicting")}
              emptyText={
                lang === "hi"
                  ? "कोई सीधा विरोधी प्रमाण दर्ज नहीं हुआ।"
                  : "No directly contradicting evidence was recorded."
              }
              tone="contradict"
              lang={lang}
            />

            <EvidenceBlock
              items={fc.importantContext}
              title={t("factCheck.missingContext")}
              emptyText={lang === "hi" ? "कोई अतिरिक्त संदर्भ दर्ज नहीं।" : "No additional context recorded."}
              tone="context"
              lang={lang}
            />

            {fc.sourceUrls.length > 0 && (
              <section className="mt-9 border-t border-rule pt-5">
                <h2 className="kicker">{t("factCheck.allSources")}</h2>
                <ul className="mt-3 space-y-1.5">
                  {fc.sourceUrls.map((sourceUrl) => (
                    <li key={sourceUrl} className="truncate">
                      <a
                        href={sourceUrl}
                        target={sourceUrl.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 font-sans text-[0.78rem] text-navy hover:text-gold-dark hover:underline hover:decoration-gold hover:underline-offset-2"
                      >
                        {sourceUrl}
                        {sourceUrl.startsWith("http") && <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {fc.corrections && fc.corrections.length > 0 && (
              <section className="mt-8">
                <h2 className="kicker">{t("common.correctionHistory")}</h2>
                <div className="mt-2">
                  <CorrectionNotice corrections={fc.corrections} lang={lang} title="" />
                </div>
              </section>
            )}

            <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
              <ShareRow url={url} title={fc.headlineEn} />
              <Link
                href={`/submit?type=correction&ref=${encodeURIComponent(fc.slug)}`}
                className="inline-flex items-center gap-1.5 border border-navy px-3 py-2 font-sans text-[0.64rem] uppercase tracking-[0.1em] text-navy transition-colors hover:bg-navy hover:text-paper"
              >
                {t("factCheck.askCorrection")}
              </Link>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="space-y-7 lg:sticky lg:top-16">
              <div className="border border-rule bg-white p-4">
                <p className="kicker">{t("factCheck.verdictLabel")}</p>
                <div className="mt-2">
                  <VerdictBadge verdict={fc.verdict} lang={lang} size="lg" />
                </div>
                <p className="mt-2.5 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                  {VERDICT_META[fc.verdict].description}
                </p>
                <dl className="mt-4 space-y-2 border-t border-rule pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                      {t("common.confidence")}
                    </dt>
                    <dd className="font-sans text-[0.75rem] capitalize text-ink">{fc.confidenceLevel}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                      {t("common.reviewer")}
                    </dt>
                    <dd className="font-sans text-[0.75rem] text-ink">{fc.reviewerName ?? "—"}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                      {t("common.verifiedOn")}
                    </dt>
                    <dd className="font-sans text-[0.75rem] text-ink">
                      {fc.verifiedAt ? formatDate(fc.verifiedAt, lang) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                      {t("common.published")}
                    </dt>
                    <dd className="font-sans text-[0.75rem] text-ink">
                      {fc.publishedAt ? formatDate(fc.publishedAt, lang) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-muted">
                      {lang === "hi" ? "संस्करण" : "Version"}
                    </dt>
                    <dd className="font-sans text-[0.75rem] text-ink">{fc.correctionVersion + 1}</dd>
                  </div>
                </dl>
              </div>

              {fc.research && (
                <div className="border border-rule bg-paper p-4">
                  <p className="kicker">{lang === "hi" ? "शोध पारदर्शिता" : "Research transparency"}</p>
                  <ul className="mt-2.5 space-y-1.5 font-sans text-[0.72rem] text-ink-soft">
                    <li className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-gold-dark" aria-hidden="true" />
                      {fc.research.aiConfigured
                        ? lang === "hi"
                          ? "AI-सहायक शोध का उपयोग हुआ; प्रत्येक प्रमाण संपादक ने जाँचा।"
                          : "AI-assisted research was used; every evidence item was checked by the editor."
                        : lang === "hi"
                          ? "इस फ़ाइल में AI शोध का उपयोग नहीं हुआ।"
                          : "No AI research was used for this file."}
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Info className="mt-0.5 h-3 w-3 shrink-0 text-gold-dark" aria-hidden="true" />
                      {fc.research.searchConfigured
                        ? lang === "hi"
                          ? "प्रमाण बाहरी खोज से लिए गए; सभी लिंक सार्वजनिक हैं।"
                          : "Evidence was retrieved through configured search; all links are public."
                        : lang === "hi"
                          ? "कोई खोज सेवा कॉन्फ़िगर नहीं थी; प्रमाण मैन्युअल रूप से जोड़े गए।"
                          : "No search provider was configured; evidence was attached manually."}
                    </li>
                    <li className="flex items-start gap-1.5">
                      <FileWarning className="mt-0.5 h-3 w-3 shrink-0 text-gold-dark" aria-hidden="true" />
                      {lang === "hi"
                        ? "अंतिम निर्णय मानव संपादक द्वारा दिया गया — मशीन द्वारा नहीं।"
                        : "The final verdict was issued by a human editor — never by a model."}
                    </li>
                  </ul>
                  <Link
                    href="/fact-checking-methodology"
                    className="mt-3 inline-block border-b border-gold pb-0.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
                  >
                    {t("footer.methodology")}
                  </Link>
                </div>
              )}

              {related.length > 0 && (
                <div className="border-t border-rule pt-3">
                  <p className="kicker mb-3">{lang === "hi" ? "अन्य जाँचें" : "Other checks"}</p>
                  <div className="space-y-3">
                    {related.map((item) => (
                      <FactCheckCard key={item.id} factCheck={item} lang={lang} variant="list" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
