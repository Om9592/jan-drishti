import Link from "next/link";
import { ArticleImage } from "@/components/ui/ArticleImage";
import { ProvenanceLabel } from "@/components/ui/ProvenanceLabel";
import { createTranslator, type Lang } from "@/lib/i18n";
import type { Article } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";

function Kicker({ article, lang }: { article: Article; lang: Lang }) {
  const t = createTranslator(lang);
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {article.categorySlug && (
        <Link
          href={`/${article.categorySlug}`}
          className="font-sans text-[0.62rem] uppercase tracking-[0.16em] text-gold-dark hover:text-navy"
        >
          {article.categorySlug.replace(/-/g, " ")}
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
  );
}

function Byline({ article, lang }: { article: Article; lang: Lang }) {
  return (
    <p className="mt-2.5 font-sans text-[0.72rem] text-ink-muted" suppressHydrationWarning>
      <span className="text-ink-soft">{article.authorName ?? "Jan Drishti"}</span>
      <span className="mx-1.5" aria-hidden="true">·</span>
      <time dateTime={article.publishedAt ?? article.updatedAt} suppressHydrationWarning>
        {article.publishedAt ? timeAgo(article.publishedAt, lang) : formatDate(article.updatedAt, lang)}
      </time>
      {article.sourceUrl && (
        <>
          <span className="mx-1.5" aria-hidden="true">·</span>
          <span className="text-gold-dark">{lang === "hi" ? "मूल स्रोत पर पढ़ें ↗" : "Read at source ↗"}</span>
        </>
      )}
    </p>
  );
}

export type CardVariant = "lead" | "feature" | "secondary" | "standard" | "compact" | "rail" | "wide";

export function ArticleCard({
  article,
  lang = "en",
  variant = "standard",
  className,
  showImage = true,
}: {
  article: Article;
  lang?: Lang;
  variant?: CardVariant;
  className?: string;
  showImage?: boolean;
}) {
  const t = createTranslator(lang);
  // Wire items link out to the publisher; Jan Drishti's own stories stay on-site.
  const external = Boolean(article.sourceUrl);
  const href = external ? (article.sourceUrl as string) : `/article/${article.slug}`;
  const linkProps = external
    ? { href, target: "_blank", rel: "noopener noreferrer nofollow" }
    : { href };
  // Own reporting keeps the typographic plate when it has no picture; a wire
  // item only gets a picture slot when the publisher's feed gave us one.
  const showArtwork = showImage && (!external || Boolean(article.imageUrl));
  const minutes = article.readingMinutes ?? 4;
  // Some feeds repeat the headline as the description — never print it twice.
  const dek = (article.summary ?? "").trim() === article.title.trim() ? "" : article.summary;

  const Title = ({ className: cls }: { className?: string }) => (
    <h3 className={cn("font-serif font-semibold text-navy", cls)}>
      <Link {...linkProps} className="headline-link">
        {article.title}
      </Link>
    </h3>
  );

  if (variant === "lead") {
    return (
      <article className={cn("group", className)}>
        <Kicker article={article} lang={lang} />
        <Title className="text-[1.75rem] leading-[1.12] tracking-[-0.01em] sm:text-[2.2rem]" />
        {(article.subtitle || dek) && (
          <p className="mt-2.5 max-w-2xl font-serif text-[1.02rem] leading-relaxed text-ink-soft sm:text-[1.1rem]">
            {article.subtitle ?? dek}
          </p>
        )}
        {showArtwork && (
          <Link {...linkProps} className="mt-5 block" tabIndex={-1} aria-hidden="true">
            <ArticleImage
              src={article.imageUrl}
              alt=""
              priority
              ratio="3/2"
              label={article.categorySlug?.replace(/-/g, " ")}
              caption={article.imageCaption}
              credit={article.imageCredit}
            />
          </Link>
        )}
        <Byline article={article} lang={lang} />
      </article>
    );
  }

  if (variant === "feature") {
    return (
      <article className={cn("group", className)}>
        {showArtwork && (
          <Link {...linkProps} className="block" tabIndex={-1} aria-hidden="true">
            <ArticleImage
              src={article.imageUrl}
              alt=""
              ratio="4/3"
              label={article.categorySlug?.replace(/-/g, " ")}
            />
          </Link>
        )}
        <div className="mt-3">
          <Kicker article={article} lang={lang} />
          <Title className="text-[1.35rem] leading-[1.16] sm:text-[1.55rem]" />
          {dek && (
            <p className="mt-2 font-sans text-[0.85rem] leading-relaxed text-ink-muted">{dek}</p>
          )}
          <Byline article={article} lang={lang} />
        </div>
      </article>
    );
  }

  if (variant === "secondary") {
    return (
      <article className={cn("group border-t border-rule pt-4", className)}>
        <Kicker article={article} lang={lang} />
        <Title className="text-[1.2rem] leading-[1.2] sm:text-[1.3rem]" />
        <div className="mt-2 flex items-center gap-2">
          <span className="font-sans text-[0.68rem] text-ink-muted">
            {article.publishedAt ? timeAgo(article.publishedAt, lang) : ""}
          </span>
          <span className="h-2 w-px bg-rule-strong" aria-hidden="true" />
          <span className="font-sans text-[0.68rem] text-ink-muted">
            {external ? article.sourceName : `${minutes} ${t("common.minutes")}`}
          </span>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article className={cn("group border-t border-rule py-3 first:border-t-0 first:pt-0", className)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Title className="text-[0.98rem] leading-snug" />
            <p className="mt-1 font-sans text-[0.66rem] uppercase tracking-[0.08em] text-ink-muted" suppressHydrationWarning>
              {article.publishedAt ? timeAgo(article.publishedAt, lang) : ""}
              {article.isSample ? ` · ${t("common.sample")}` : ""}
            </p>
          </div>
          {article.imageUrl && (
            <div className="relative h-16 w-20 shrink-0 overflow-hidden bg-paper-deep">
              <ArticleImage src={article.imageUrl} alt="" ratio="4/3" className="h-full" />
            </div>
          )}
        </div>
      </article>
    );
  }

  if (variant === "rail") {
    return (
      <article className={cn("group", className)}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 h-full w-px shrink-0 bg-gold/50" aria-hidden="true" />
          <div>
            <Title className="text-[1rem] leading-snug" />
            <p className="mt-1 font-sans text-[0.65rem] uppercase tracking-[0.08em] text-ink-muted" suppressHydrationWarning>
              {article.categorySlug?.replace(/-/g, " ")} ·{" "}
              {article.publishedAt ? timeAgo(article.publishedAt, lang) : ""}
            </p>
          </div>
        </div>
      </article>
    );
  }

  if (variant === "wide") {
    return (
      <article
        className={cn(
          "group grid gap-4",
          showArtwork && "sm:grid-cols-[minmax(0,1fr)_18rem]",
          className,
        )}
      >
        <div>
          <Kicker article={article} lang={lang} />
          <Title className="text-[1.3rem] leading-[1.18] sm:text-[1.45rem]" />
          {dek && <p className="mt-2 font-sans text-[0.88rem] leading-relaxed text-ink-soft">{dek}</p>}
          <Byline article={article} lang={lang} />
        </div>
        {showArtwork && (
          <Link {...linkProps} tabIndex={-1} aria-hidden="true" className="order-first sm:order-last">
            <ArticleImage src={article.imageUrl} alt="" ratio="4/3" sizes="18rem" />
          </Link>
        )}
      </article>
    );
  }

  return (
    <article className={cn("group", className)}>
      {showArtwork && (
        <Link {...linkProps} tabIndex={-1} aria-hidden="true" className="block">
          <ArticleImage src={article.imageUrl} alt="" ratio="3/2" sizes="(max-width: 768px) 100vw, 33vw" />
        </Link>
      )}
      <div className={showArtwork ? "mt-3" : ""}>
        <Kicker article={article} lang={lang} />
        <Title className="text-[1.15rem] leading-[1.2] sm:text-[1.25rem]" />
        {dek && (
          <p className="mt-1.5 font-sans text-[0.82rem] leading-relaxed text-ink-muted">{dek}</p>
        )}
        <Byline article={article} lang={lang} />
      </div>
    </article>
  );
}
