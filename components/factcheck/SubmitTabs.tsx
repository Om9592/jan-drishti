"use client";

import { useState } from "react";
import { SubmissionForm } from "@/components/factcheck/SubmissionForm";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

type SubmissionType = "viral_claim" | "news_tip" | "correction_request";

export function SubmitTabs({ initialType = "viral_claim" }: { initialType?: SubmissionType }) {
  const { t } = useLanguage();
  const [type, setType] = useState<SubmissionType>(initialType);

  const tabs: { value: SubmissionType; label: string; hint: string }[] = [
    { value: "viral_claim", label: t("submit.tabClaim"), hint: t("factCheck.form.contentHint") },
    { value: "news_tip", label: t("submit.tabTip"), hint: t("submit.tipHint") },
    { value: "correction_request", label: t("submit.tabCorrection"), hint: t("submit.correctionHint") },
  ];

  const active = tabs.find((tab) => tab.value === type)!;

  return (
    <div>
      <div role="tablist" aria-label={t("submit.title")} className="flex flex-wrap gap-0 border-b border-rule">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={type === tab.value}
            type="button"
            onClick={() => setType(tab.value)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 font-sans text-[0.7rem] uppercase tracking-[0.1em] transition-colors",
              type === tab.value
                ? "border-gold text-navy"
                : "border-transparent text-ink-muted hover:text-navy",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="mt-3 font-sans text-[0.78rem] leading-relaxed text-ink-muted">{active.hint}</p>
      <div className="mt-4">
        <SubmissionForm type={type} onTypeChange={setType} />
      </div>
    </div>
  );
}
