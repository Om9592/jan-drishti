import { ExternalLink, FileText, Landmark, Newspaper, BookOpen, MessageSquare, CircleHelp } from "lucide-react";
import { createTranslator, type Lang } from "@/lib/i18n";
import type { SourceRef, SourceType } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

const SOURCE_TYPE_META: Record<
  SourceType,
  { en: string; hi: string; icon: typeof FileText; className: string }
> = {
  government: { en: "Government statement", hi: "सरकारी वक्तव्य", icon: Landmark, className: "text-verdict-true" },
  primary_record: { en: "Primary record", hi: "मूल अभिलेख", icon: FileText, className: "text-verdict-true" },
  independent_journalism: {
    en: "Independent journalism",
    hi: "स्वतंत्र पत्रकारिता",
    icon: Newspaper,
    className: "text-navy",
  },
  research: { en: "Research publication", hi: "शोध प्रकाशन", icon: BookOpen, className: "text-verdict-outdated" },
  opinion: { en: "Opinion", hi: "टिप्पणी", icon: MessageSquare, className: "text-verdict-misleading" },
  social_media: { en: "Social media claim", hi: "सोशल मीडिया दावा", icon: MessageSquare, className: "text-ink-muted" },
  other: { en: "Other source", hi: "अन्य स्रोत", icon: CircleHelp, className: "text-ink-muted" },
};

export function SourceList({
  sources,
  lang = "en",
  title,
  compact = false,
}: {
  sources: SourceRef[];
  lang?: Lang;
  title?: string;
  compact?: boolean;
}) {
  const t = createTranslator(lang);
  if (!sources || sources.length === 0) return null;

  return (
    <section aria-label={title ?? t("common.sources")}>
      {title !== "" && (
        <h2 className="kicker border-t border-rule pt-3">{title ?? t("common.sources")}</h2>
      )}
      <ul className={cn("mt-3 space-y-3", compact && "space-y-2")}>
        {sources.map((source, index) => {
          const meta = SOURCE_TYPE_META[source.type] ?? SOURCE_TYPE_META.other;
          const Icon = meta.icon;
          return (
            <li key={source.id || `${source.url}-${index}`} className="border-l border-rule pl-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Icon className={cn("h-3 w-3", meta.className)} aria-hidden="true" />
                <span className={cn("font-sans text-[0.58rem] uppercase tracking-[0.1em]", meta.className)}>
                  {lang === "hi" ? meta.hi : meta.en}
                </span>
                {source.isPrimary && (
                  <span className="border border-gold/60 px-1 font-sans text-[0.52rem] uppercase tracking-[0.1em] text-gold-dark">
                    {lang === "hi" ? "प्राथमिक" : "Primary"}
                  </span>
                )}
              </div>
              <a
                href={source.url}
                target={source.url.startsWith("http") ? "_blank" : undefined}
                rel={source.url.startsWith("http") ? "noopener noreferrer nofollow" : undefined}
                className="mt-1 inline-flex items-start gap-1 font-sans text-[0.82rem] leading-snug text-navy hover:text-gold-dark hover:underline hover:decoration-gold hover:underline-offset-2"
              >
                {source.name}
                {source.url.startsWith("http") && (
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                )}
              </a>
              <p className="mt-0.5 font-sans text-[0.68rem] text-ink-muted">
                {source.publisher}
                {source.publishedAt && ` · ${formatDate(source.publishedAt, lang)}`}
                {source.accessedAt && ` · accessed ${formatDate(source.accessedAt, lang)}`}
              </p>
              {source.note && (
                <p className="mt-1 font-sans text-[0.72rem] leading-relaxed text-ink-soft">{source.note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SourceTypeLabel({ type, lang = "en" }: { type: SourceType; lang?: Lang }) {
  const meta = SOURCE_TYPE_META[type] ?? SOURCE_TYPE_META.other;
  return (
    <span className={cn("font-sans text-[0.58rem] uppercase tracking-[0.1em]", meta.className)}>
      {lang === "hi" ? meta.hi : meta.en}
    </span>
  );
}
