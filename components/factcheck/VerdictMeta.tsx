import { createTranslator, type Lang } from "@/lib/i18n";
import type { FactCheck } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

/** Compact metadata strip used under a fact-check headline. */
export function VerdictMeta({ factCheck, lang = "en" }: { factCheck: FactCheck; lang?: Lang }) {
  const t = createTranslator(lang);

  const items = [
    {
      label: t("common.reviewer"),
      value: factCheck.reviewerName ?? "—",
    },
    {
      label: t("common.verifiedOn"),
      value: factCheck.verifiedAt ? formatDateTime(factCheck.verifiedAt, lang) : "—",
    },
    {
      label: t("common.confidence"),
      value: factCheck.confidenceLevel,
      capitalize: true,
    },
    {
      label: lang === "hi" ? "प्रमाण" : "Evidence items",
      value: String(
        factCheck.supportingEvidence.length +
          factCheck.contradictingEvidence.length +
          factCheck.importantContext.length,
      ),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5 border-y border-rule py-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="font-sans text-[0.58rem] uppercase tracking-[0.12em] text-ink-muted">{item.label}</dt>
          <dd className={`mt-0.5 font-sans text-[0.78rem] text-ink ${item.capitalize ? "capitalize" : ""}`}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
