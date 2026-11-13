import { createTranslator, type Lang } from "@/lib/i18n";
import type { ArticleKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Readers must always be able to tell original reporting from summary,
 * syndicated or opinion content. This label is never optional.
 */
export function ProvenanceLabel({
  kind,
  lang = "en",
  showOriginal = true,
  className,
}: {
  kind: ArticleKind;
  lang?: Lang;
  showOriginal?: boolean;
  className?: string;
}) {
  const t = createTranslator(lang);
  if (kind === "original" && !showOriginal) return null;
  const label = t(`common.kind.${kind}`);
  const isOpinion = kind === "opinion";
  const isExternal = kind === "external";

  return (
    <span
      className={cn(
        "font-sans text-[0.58rem] uppercase tracking-[0.14em]",
        isOpinion ? "text-verdict-outdated" : isExternal ? "text-verdict-misleading" : "text-ink-muted",
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
