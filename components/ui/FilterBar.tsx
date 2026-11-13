import Link from "next/link";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Filter row rendered as real links (crawlable, works without JS).
 * `basePath` + current params are preserved by the caller's buildHref.
 */
export function FilterBar({
  label,
  options,
  active,
  buildHref,
  className,
}: {
  label: string;
  options: FilterOption[];
  active: string;
  buildHref: (value: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
      <span className="mr-1 font-sans text-[0.6rem] uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      {options.map((option) => (
        <Link
          key={option.value}
          href={buildHref(option.value)}
          aria-current={active === option.value ? "true" : undefined}
          className={cn(
            "border px-2.5 py-1 font-sans text-[0.66rem] uppercase tracking-[0.08em] transition-colors",
            active === option.value
              ? "border-navy bg-navy text-paper"
              : "border-rule text-ink-soft hover:border-navy hover:text-navy",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
