import Link from "next/link";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { createTranslator, type Lang } from "@/lib/i18n";
import type { FactCheck } from "@/lib/types";
import { cn, formatDate, truncate } from "@/lib/utils";

const CONFIDENCE_LABELS: Record<"en" | "hi", Record<"low" | "medium" | "high", string>> = {
  en: { low: "Low", medium: "Medium", high: "High" },
  hi: { low: "कम", medium: "मध्यम", high: "उच्च" },
};

export function FactCheckCard({
  factCheck,
  lang = "en",
  variant = "standard",
  className,
}: {
  factCheck: FactCheck;
  lang?: Lang;
  variant?: "standard" | "list" | "panel";
  className?: string;
}) {
  const t = createTranslator(lang);
  const href = `/fact-check/${factCheck.slug}`;
  const claim = truncate(
    factCheck.claimText
      .replace(/^Illustrative sample claim[^:]*:\s*/i, "")
      .replace(/^[\u201C\u201D\u2018\u2019"']+|[\u201C\u201D\u2018\u2019"']+$/g, ""),
    190,
  );

  if (variant === "panel") {
    const panelEvidence = [...factCheck.contradictingEvidence, ...factCheck.supportingEvidence].slice(0, 3);
    return (
      <article className={cn("flex h-full flex-col", className)}>
        <div className="flex items-center justify-between gap-3">
          <VerdictBadge verdict={factCheck.verdict} lang={lang} />
          {factCheck.isSample && (
            <span className="font-sans text-[0.55rem] uppercase tracking-[0.12em] text-paper/60">
              {t("common.sample")}
            </span>
          )}
        </div>
        <blockquote className="mt-4 font-serif text-[1.15rem] leading-snug text-paper sm:text-[1.3rem]">
          “{claim}”
        </blockquote>
        <p className="mt-3 font-sans text-[0.82rem] leading-relaxed text-paper/70">
          {truncate(factCheck.explanationEn, 210)}
        </p>
        {panelEvidence.length > 0 && (
          <div className="mt-5 flex-1">
            <p className="font-sans text-[0.55rem] uppercase tracking-[0.14em] text-paper/45">
              {lang === "hi" ? "प्रमाण जिन्हें हम जाँचते हैं" : "Evidence we can point to"}
            </p>
            <ul className="mt-2 space-y-1.5">
              {panelEvidence.map((item) => (
                <li key={item.id} className="flex gap-2 font-sans text-[0.74rem] leading-snug text-paper/70">
                  <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 bg-gold" />
                  <span>
                    {truncate(item.title, 78)}
                    <span className="text-paper/40"> — {item.publisher}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-paper/20 pt-4">
          <div>
            <dt className="font-sans text-[0.55rem] uppercase tracking-[0.12em] text-paper/45">
              {t("common.confidence")}
            </dt>
            <dd className="mt-1 font-sans text-[0.72rem] text-paper/85">
              {CONFIDENCE_LABELS[lang][factCheck.confidenceLevel]}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-[0.55rem] uppercase tracking-[0.12em] text-paper/45">
              {t("common.sourcesChecked")}
            </dt>
            <dd className="mt-1 font-sans text-[0.72rem] text-paper/85">
              {factCheck.sourceUrls.length}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-[0.55rem] uppercase tracking-[0.12em] text-paper/45">
              {t("common.claimLanguage")}
            </dt>
            <dd className="mt-1 font-sans text-[0.72rem] text-paper/85">
              {factCheck.claimLanguage === "hi" ? "हिंदी" : "English"}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex items-center justify-between border-t border-paper/20 pt-3">
          <span className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-paper/55">
            {factCheck.reviewerName ? `${t("common.reviewer")}: ${factCheck.reviewerName}` : t("factCheck.noVerdict")}
          </span>
          <Link
            href={href}
            className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-gold transition-colors hover:text-paper"
          >
            {t("common.readReport")}
          </Link>
        </div>
      </article>
    );
  }

  if (variant === "list") {
    return (
      <article className={cn("group border-t border-rule py-4 first:border-t-0 first:pt-0", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <VerdictBadge verdict={factCheck.verdict} lang={lang} size="sm" />
            <h3 className="mt-2 font-serif text-[1.02rem] leading-snug text-navy">
              <Link href={href} className="headline-link">
                {factCheck.headlineEn}
              </Link>
            </h3>
            <p className="mt-1 font-sans text-[0.75rem] leading-relaxed text-ink-muted">{claim}</p>
          </div>
          <span className="shrink-0 font-sans text-[0.62rem] text-ink-muted" suppressHydrationWarning>
            {formatDate(factCheck.publishedAt ?? factCheck.updatedAt, lang, { day: "numeric", month: "short" })}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group flex h-full flex-col border-t-2 border-navy pt-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <VerdictBadge verdict={factCheck.verdict} lang={lang} size="sm" />
        <span className="font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
          {factCheck.isSample ? t("common.sample") : t("nav.factCheck")}
        </span>
      </div>
      <h3 className="mt-3 font-serif text-[1.12rem] leading-snug text-navy">
        <Link href={href} className="headline-link">
          {factCheck.headlineEn}
        </Link>
      </h3>
      <p className="mt-2 flex-1 font-sans text-[0.78rem] leading-relaxed text-ink-muted">
        {truncate(factCheck.explanationEn, 160)}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-rule pt-2">
        <span className="font-sans text-[0.62rem] text-ink-muted" suppressHydrationWarning>
          {formatDate(factCheck.publishedAt ?? factCheck.updatedAt, lang)}
        </span>
        <span className="font-sans text-[0.6rem] uppercase tracking-[0.1em] text-gold-dark opacity-0 transition-opacity group-hover:opacity-100">
          {t("common.readReport")}
        </span>
      </div>
    </article>
  );
}
