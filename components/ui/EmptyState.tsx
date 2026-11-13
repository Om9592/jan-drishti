import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("border border-dashed border-rule-strong bg-paper-warm/40 px-6 py-12 text-center", className)}>
      <span className="mx-auto block h-px w-10 bg-gold" aria-hidden="true" />
      <h3 className="mt-4 font-serif text-[1.3rem] text-navy">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-md font-sans text-[0.85rem] leading-relaxed text-ink-muted">{body}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-block border-b border-gold pb-0.5 font-sans text-[0.7rem] uppercase tracking-[0.12em] text-navy hover:text-gold-dark"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
