"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X, UserRound, ChevronRight } from "lucide-react";
import { Wordmark } from "@/components/ui/MastheadMark";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn, formatDate } from "@/lib/utils";
import type { Viewer } from "@/lib/types";

export interface NavCategory {
  slug: string;
  label: string;
}

interface HeaderProps {
  categories: NavCategory[];
  latestHeadline?: { title: string; slug: string } | null;
  viewer: Viewer | null;
}

export function Header({ categories, latestHeadline, viewer }: HeaderProps) {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const today = formatDate(new Date().toISOString(), lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const PRIMARY_SLUGS = ["india", "politics", "economy", "education", "health", "states", "ground-reports"];

  const SHORT_LABELS: Record<string, string> = {
    india: t("nav.india"),
    politics: t("nav.politics"),
    economy: t("nav.economy"),
    education: t("nav.education"),
    health: t("nav.health"),
    states: t("nav.states"),
    "ground-reports": t("nav.groundReports"),
  };

  const navItems = [
    { href: "/", label: t("nav.home") },
    { href: "/latest", label: t("nav.latest") },
    ...categories
      .filter((c) => PRIMARY_SLUGS.includes(c.slug))
      .map((c) => ({ href: `/${c.slug}`, label: SHORT_LABELS[c.slug] ?? c.label })),
  ];

  const overflowItems = categories.filter((c) => !PRIMARY_SLUGS.includes(c.slug) && c.slug !== "fact-check");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const accountLabel = viewer?.authenticated ? (viewer.name ?? t("nav.account")) : t("nav.login");
  const isContributor = viewer?.role === "contributor";
  const accountHref = !viewer?.authenticated
    ? "/login"
    : isContributor && !viewer.demo
      ? "/contribute/desk"
      : "/profile";

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[70] focus:bg-navy focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      {/* Utility strip */}
      <div className="bg-navy text-paper">
        <div className="container-editorial flex h-9 items-center justify-between gap-4 text-[0.6875rem] uppercase tracking-[0.1em]">
          <div className="flex shrink-0 items-center gap-3">
            <time dateTime={new Date().toISOString()} className="whitespace-nowrap text-paper/85" suppressHydrationWarning>
              {today}
            </time>
            <span className="hidden h-3 w-px bg-paper/25 sm:block" aria-hidden="true" />
            <span className="hidden whitespace-nowrap text-gold xl:block">{t("masthead.independent")}</span>
          </div>

          {latestHeadline && (
            <Link
              href={`/article/${latestHeadline.slug}`}
              className="hidden min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden text-paper/75 transition-colors hover:text-paper lg:flex"
            >
              <span className="shrink-0 text-gold">{t("masthead.latestIndicator")}</span>
              <span className="truncate normal-case tracking-normal">{latestHeadline.title}</span>
            </Link>
          )}

          <div className="flex shrink-0 items-center gap-3">
            <Link href="/corrections" className="hidden text-paper/75 hover:text-paper md:block">
              {t("footer.corrections")}
            </Link>
            <Link href="/contribute" className="hidden text-gold hover:text-gold-light md:block">
              {t("nav.writeForUs")}
            </Link>
            <Link href="/editorial-policy" className="hidden text-paper/75 hover:text-paper lg:block">
              {t("footer.policy")}
            </Link>
            <LanguageSwitcher tone="dark" />
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="border-b border-rule bg-paper">
        <div className="container-editorial grid grid-cols-[1fr_auto] items-center gap-4 py-4 md:grid-cols-3 md:py-6">
          <div className="hidden md:block">
            <p className="max-w-[15rem] font-serif text-[0.8125rem] italic leading-relaxed text-ink-muted">
              {lang === "hi" ? t("brand.taglineHi") : t("brand.tagline")}
            </p>
            <span className="mt-2 block h-px w-10 bg-gold" aria-hidden="true" />
          </div>

          <Link href="/" className="flex justify-start md:justify-center" aria-label={`${t("brand.name")} — ${t("nav.home")}`}>
            <Wordmark />
          </Link>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 border border-transparent px-2 py-2 text-ink-soft transition-colors hover:border-rule-strong hover:text-navy"
              aria-label={t("search.title")}
            >
              <Search className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
              <span className="hidden font-sans text-[0.7rem] uppercase tracking-[0.12em] sm:inline">
                {t("search.title")}
              </span>
            </button>
            <span className="hidden h-4 w-px bg-rule-strong sm:block" aria-hidden="true" />
            <Link
              href={accountHref}
              className="hidden items-center gap-1.5 px-1 font-sans text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-navy sm:flex"
            >
              <UserRound className="h-[0.95rem] w-[0.95rem]" aria-hidden="true" />
              <span className="max-w-[7rem] truncate">{accountLabel}</span>
            </Link>
            <Link
              href="/submit"
              className="hidden items-center gap-1.5 border border-navy px-3 py-2 font-sans text-[0.65rem] uppercase tracking-[0.12em] text-navy transition-colors hover:bg-navy hover:text-paper lg:inline-flex"
            >
              {t("nav.submit")}
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center border border-rule-strong text-navy md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label={t("nav.menu")}
              aria-expanded={menuOpen}
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Sections" className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="container-editorial hidden items-center justify-between md:flex">
          <ul className="no-scrollbar flex items-stretch overflow-x-auto">
            {navItems.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "group relative flex h-11 items-center px-2.5 font-sans text-[0.68rem] uppercase tracking-[0.11em] transition-colors lg:px-3",
                    isActive(item.href) ? "text-navy" : "text-ink-soft hover:text-navy",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "absolute inset-x-2 bottom-0 h-[2px] bg-navy transition-transform duration-200 ease-editorial",
                      isActive(item.href) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}

            <li className="shrink-0">
              <Link
                href="/ask"
                aria-current={isActive("/ask") ? "page" : undefined}
                className={cn(
                  "group relative flex h-11 items-center gap-1 px-2.5 font-sans text-[0.68rem] uppercase tracking-[0.11em] transition-colors lg:px-3",
                  isActive("/ask") ? "text-gold-dark" : "text-gold-dark hover:text-navy",
                )}
              >
                {t("nav.ask")}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-[2px] bg-gold transition-transform duration-200 ease-editorial",
                    isActive("/ask") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                  aria-hidden="true"
                />
              </Link>
            </li>

            <li className="shrink-0">
              <Link
                href="/fact-check"
                aria-current={isActive("/fact-check") ? "page" : undefined}
                className={cn(
                  "group relative flex h-11 items-center gap-1 px-2.5 font-sans text-[0.68rem] uppercase tracking-[0.11em] transition-colors lg:px-3",
                  isActive("/fact-check") ? "text-gold-dark" : "text-gold-dark hover:text-navy",
                )}
              >
                {t("nav.factCheck")}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-[2px] bg-gold transition-transform duration-200 ease-editorial",
                    isActive("/fact-check") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                  aria-hidden="true"
                />
              </Link>
            </li>

            <li className="shrink-0">
              <Link
                href="/contributors"
                aria-current={isActive("/contributors") ? "page" : undefined}
                className={cn(
                  "group relative flex h-11 items-center px-2.5 font-sans text-[0.68rem] uppercase tracking-[0.11em] transition-colors lg:px-3",
                  isActive("/contributors") ? "text-navy" : "text-ink-soft hover:text-navy",
                )}
              >
                {t("nav.contributors")}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-[2px] bg-navy transition-transform duration-200 ease-editorial",
                    isActive("/contributors") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                  aria-hidden="true"
                />
              </Link>
            </li>

            {overflowItems.length > 0 && (
              <li className="relative shrink-0">
                <details className="group/more">
                  <summary className="flex h-11 cursor-pointer list-none items-center px-2.5 font-sans text-[0.68rem] uppercase tracking-[0.11em] text-ink-muted transition-colors hover:text-navy lg:px-3">
                    {t("nav.more")}
                  </summary>
                  <div className="absolute left-0 top-full z-30 w-52 border border-rule bg-paper py-1 shadow-lift">
                    {overflowItems.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/${c.slug}`}
                        className="block px-3 py-2 font-sans text-[0.8rem] text-ink-soft transition-colors hover:bg-paper-warm hover:text-navy"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </details>
              </li>
            )}
          </ul>
          {viewer && (viewer.role === "editor" || viewer.role === "admin" || viewer.role === "researcher") && (
            <Link
              href="/admin"
              className="ml-4 shrink-0 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-muted hover:text-navy"
            >
              {t("nav.admin")}
            </Link>
          )}
          {isContributor && (
            <Link
              href="/contribute/desk"
              className="ml-4 shrink-0 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-gold-dark hover:text-navy"
            >
              {t("nav.contributeDesk")}
            </Link>
          )}
        </div>

        {/* Mobile bar */}
        <div className="flex h-12 items-center justify-between px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-2 font-sans text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft"
            aria-expanded={menuOpen}
          >
            <Menu className="h-4 w-4" aria-hidden="true" /> {t("nav.menu")}
          </button>
          <Link
            href="/ask"
            className="font-sans text-[0.7rem] uppercase tracking-[0.12em] text-gold-dark"
          >
            {t("nav.ask")}
          </Link>
          <Link
            href="/submit"
            className="font-sans text-[0.7rem] uppercase tracking-[0.12em] text-navy"
          >
            {t("nav.submit")}
          </Link>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div className="absolute inset-0 bg-navy-900/60" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-paper shadow-lift">
            <div className="flex items-center justify-between border-b border-rule px-5 py-4">
              <Wordmark compact />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t("nav.close")}
                className="p-2 text-ink-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-5 py-4" aria-label="Sections">
              <ul className="divide-y divide-rule">
                {[
                  { href: "/", label: t("nav.home") },
                  { href: "/latest", label: t("nav.latest") },
                  ...categories.map((c) => ({ href: `/${c.slug}`, label: c.label })),
                  { href: "/ask", label: t("nav.ask") },
                  { href: "/fact-check", label: t("nav.factCheck") },
                  { href: "/contributors", label: t("nav.contributors") },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center justify-between py-3 font-serif text-[1.05rem]",
                        isActive(item.href) ? "text-gold-dark" : "text-navy",
                      )}
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid gap-2">
                <Link href="/submit" onClick={() => setMenuOpen(false)} className="btn-primary w-full">
                  {t("nav.submit")}
                </Link>
                <Link href="/contribute" onClick={() => setMenuOpen(false)} className="btn-outline w-full">
                  {t("nav.writeForUs")}
                </Link>
                <Link href={accountHref} onClick={() => setMenuOpen(false)} className="btn-outline w-full">
                  {accountLabel}
                </Link>
                {viewer && (viewer.role === "editor" || viewer.role === "admin" || viewer.role === "researcher") && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} className="btn-outline w-full">
                    {t("nav.admin")}
                  </Link>
                )}
                {isContributor && (
                  <Link href="/contribute/desk" onClick={() => setMenuOpen(false)} className="btn-outline w-full">
                    {t("nav.contributeDesk")}
                  </Link>
                )}
              </div>
              <div className="mt-6 border-t border-rule pt-4">
                <LanguageSwitcher />
              </div>
            </nav>
            <div className="border-t border-rule px-5 py-3">
              <p className="font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">
                {t("masthead.independent")}
              </p>
            </div>
          </div>
        </div>
      )}

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
