import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Clock, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERDICT_META } from "@/lib/utils";
import type { Language, Verdict } from "@/lib/types";

const ICONS: Record<Verdict, typeof CheckCircle2> = {
  verified_true: CheckCircle2,
  false: XCircle,
  misleading: AlertTriangle,
  unverified: HelpCircle,
  outdated: Clock,
  disputed: Scale,
};

export function VerdictBadge({
  verdict,
  lang = "en",
  size = "md",
  withIcon = true,
  className,
}: {
  verdict: Verdict;
  lang?: Language;
  size?: "sm" | "md" | "lg";
  withIcon?: boolean;
  className?: string;
}) {
  const meta = VERDICT_META[verdict];
  const Icon = ICONS[verdict];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border font-sans font-medium uppercase",
        size === "sm" && "px-2 py-0.5 text-[0.6rem] tracking-[0.1em]",
        size === "md" && "px-2.5 py-1 text-[0.68rem] tracking-[0.1em]",
        size === "lg" && "px-3.5 py-1.5 text-[0.78rem] tracking-[0.12em]",
        meta.tone,
        className,
      )}
    >
      {withIcon && <Icon className={cn(size === "lg" ? "h-4 w-4" : "h-3 w-3")} aria-hidden="true" />}
      {lang === "hi" ? meta.hi : meta.en}
    </span>
  );
}
