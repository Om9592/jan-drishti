"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { VERDICT_META } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

interface Suggestion {
  id: string;
  title: string;
  slug: string;
  categorySlug?: string;
}

interface FactSuggestion {
  id: string;
  headline: string;
  slug: string;
  verdict: Verdict;
}

export function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<Suggestion[]>([]);
  const [factChecks, setFactChecks] = useState<FactSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setArticles([]);
      setFactChecks([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { articles?: Suggestion[]; factChecks?: FactSuggestion[] };
          setArticles(data.articles ?? []);
          setFactChecks(data.factChecks ?? []);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  if (!open) return null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy-900/70 px-4 pt-[12vh] backdrop-blur-sm">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("search.title")}
        className="relative w-full max-w-2xl border border-rule bg-paper shadow-lift"
      >
        <form onSubmit={submit} className="flex items-center gap-3 border-b border-rule px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("search.placeholder")}
            className="w-full bg-transparent font-serif text-[1.15rem] text-navy outline-none placeholder:font-sans placeholder:text-[0.95rem] placeholder:text-ink-muted/70"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-ink-muted" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            className="rounded-none p-1 text-ink-muted transition-colors hover:text-navy"
            aria-label={t("nav.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </form>

        <div className="max-h-[52vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-5 py-6 font-sans text-[0.85rem] leading-relaxed text-ink-muted">
              {t("search.placeholder")} — {t("search.emptyHint")}
            </p>
          ) : articles.length === 0 && factChecks.length === 0 && !loading ? (
            <div className="px-5 py-6">
              <p className="font-serif text-[1.05rem] text-navy">{t("search.empty")}</p>
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                className="mt-2 inline-flex items-center gap-1 font-sans text-[0.8rem] uppercase tracking-[0.1em] text-gold-dark hover:text-navy"
                onClick={onClose}
              >
                {t("search.title")} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              {articles.length > 0 && (
                <div className="border-b border-rule px-5 py-4">
                  <p className="kicker mb-2.5">{t("search.type.articles")}</p>
                  <ul className="space-y-2.5">
                    {articles.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/article/${item.slug}`}
                          onClick={onClose}
                          className="group flex items-start justify-between gap-3"
                        >
                          <span className="font-serif text-[1rem] leading-snug text-navy group-hover:text-gold-dark">
                            {item.title}
                          </span>
                          {item.categorySlug && (
                            <span className="mt-0.5 shrink-0 font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted">
                              {item.categorySlug.replace("-", " ")}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {factChecks.length > 0 && (
                <div className="px-5 py-4">
                  <p className="kicker mb-2.5">{t("search.type.factChecks")}</p>
                  <ul className="space-y-2.5">
                    {factChecks.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/fact-check/${item.slug}`}
                          onClick={onClose}
                          className="group flex items-start justify-between gap-3"
                        >
                          <span className="font-serif text-[1rem] leading-snug text-navy group-hover:text-gold-dark">
                            {item.headline}
                          </span>
                          <span className="mt-0.5 shrink-0 font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted">
                            {VERDICT_META[item.verdict]?.en ?? item.verdict}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-rule bg-paper-warm px-5 py-2.5">
          <span className="font-sans text-[0.65rem] uppercase tracking-[0.12em] text-ink-muted">
            Enter to see all results
          </span>
          <Link
            href="/search"
            onClick={onClose}
            className="font-sans text-[0.65rem] uppercase tracking-[0.12em] text-navy hover:text-gold-dark"
          >
            {t("search.filters")}
          </Link>
        </div>
      </div>
    </div>
  );
}
