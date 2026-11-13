import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  href,
  linkLabel,
  description,
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("section-heading", className)}>
      <div>
        <h2 className="font-serif text-[1.35rem] font-semibold leading-none text-navy sm:text-[1.5rem]">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-xl font-sans text-[0.8rem] leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 font-sans text-[0.65rem] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-navy"
        >
          {linkLabel ?? "See all"}
          <ArrowRight className="h-3 w-3 transition-transform duration-200 ease-editorial group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
