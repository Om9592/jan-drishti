import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createTranslator, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  buildHref,
  lang = "en",
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  lang?: Lang;
}) {
  const t = createTranslator(lang);
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between border-t border-rule pt-4">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="inline-flex items-center gap-1.5 font-sans text-[0.7rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
          rel="prev"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> {t("common.previous")}
        </Link>
      ) : (
        <span />
      )}

      <ol className="flex items-center gap-1">
        {pages.map((p, index) => (
          <li key={p} className="flex items-center gap-1">
            {index > 0 && pages[index - 1] !== p - 1 && (
              <span className="px-1 text-ink-muted" aria-hidden="true">
                …
              </span>
            )}
            <Link
              href={buildHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center border px-2 font-sans text-[0.75rem]",
                p === page
                  ? "border-navy bg-navy text-paper"
                  : "border-rule text-ink-soft hover:border-navy hover:text-navy",
              )}
            >
              {p}
            </Link>
          </li>
        ))}
      </ol>

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="inline-flex items-center gap-1.5 font-sans text-[0.7rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
          rel="next"
        >
          {t("common.next")} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
