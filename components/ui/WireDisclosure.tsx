import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Readers must be told, in the same breath as the content, that wire headlines
 * come from other publishers and are not this newsroom's verified reporting.
 */
export function WireDisclosure({
  lang = "en",
  publishers,
  className,
}: {
  lang?: Lang;
  publishers: string[];
  className?: string;
}) {
  if (publishers.length === 0) return null;

  return (
    <p
      className={cn(
        "mt-4 border-l-2 border-gold/70 bg-gold/[0.05] px-3 py-2 font-sans text-[0.72rem] leading-relaxed text-ink-muted",
        className,
      )}
    >
      <span className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-gold-dark">
        {lang === "hi" ? "वायर" : "Wire"}
      </span>
      <span className="mx-1.5" aria-hidden="true">·</span>
      {lang === "hi"
        ? `सुर्ख़ियाँ ${publishers.join(", ")} से — साफ़ नाम, तिथि और मूल लिंक के साथ। सारांश उनके हैं, जाँच हमारी नहीं; पूरी ख़बर स्रोत पर पढ़ें।`
        : `Headlines from ${publishers.join(", ")} — named, dated and linked to the original. The reporting is theirs, not independently verified by Jan Drishti; the full story opens at the publisher.`}
      <Link
        href="/editorial-policy"
        className="ml-1 underline decoration-rule-strong underline-offset-2 hover:text-navy"
      >
        {lang === "hi" ? "हमारी सोर्सिंग नीति" : "Our sourcing policy"}
      </Link>
    </p>
  );
}
