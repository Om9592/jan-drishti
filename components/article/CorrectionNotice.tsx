import { AlertCircle } from "lucide-react";
import { createTranslator, type Lang } from "@/lib/i18n";
import type { Correction } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function CorrectionNotice({
  corrections,
  lang = "en",
  title,
}: {
  corrections: Correction[];
  lang?: Lang;
  title?: string;
}) {
  const t = createTranslator(lang);
  if (!corrections || corrections.length === 0) return null;

  return (
    <section
      aria-label={title ?? t("common.correctionHistory")}
      className="border-l-2 border-gold bg-gold/[0.07] px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-gold-dark" aria-hidden="true" />
        <h2 className="font-sans text-[0.62rem] uppercase tracking-[0.14em] text-gold-dark">
          {title ?? t("common.corrections")}
        </h2>
      </div>
      <ul className="mt-2 space-y-2">
        {corrections.map((correction) => (
          <li key={correction.id} className="font-sans text-[0.8rem] leading-relaxed text-ink-soft">
            <time dateTime={correction.date} className="mr-2 font-medium text-ink">
              {formatDate(correction.date, lang)}
            </time>
            {lang === "hi" && correction.summaryHi ? correction.summaryHi : correction.summaryEn}
            {correction.detailEn && (
              <span className="mt-0.5 block text-[0.75rem] text-ink-muted">
                {lang === "hi" && correction.detailHi ? correction.detailHi : correction.detailEn}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
