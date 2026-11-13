"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: "en" | "hi") {
    if (next === lang) return;
    document.cookie = `jd_lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={cn(
        "inline-flex items-center border text-[0.6875rem] font-medium uppercase tracking-[0.12em]",
        tone === "dark" ? "border-paper/25" : "border-rule-strong",
        pending && "opacity-60",
      )}
      role="group"
      aria-label={t("lang.label")}
    >
      <button
        type="button"
        onClick={() => switchTo("en")}
        aria-pressed={lang === "en"}
        className={cn(
          "px-2.5 py-1.5 transition-colors",
          lang === "en"
            ? tone === "dark"
              ? "bg-paper text-navy"
              : "bg-navy text-paper"
            : tone === "dark"
              ? "text-paper/70 hover:text-paper"
              : "text-ink-muted hover:text-navy",
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo("hi")}
        aria-pressed={lang === "hi"}
        className={cn(
          "px-2.5 py-1.5 font-sans-hi transition-colors",
          lang === "hi"
            ? tone === "dark"
              ? "bg-paper text-navy"
              : "bg-navy text-paper"
            : tone === "dark"
              ? "text-paper/70 hover:text-paper"
              : "text-ink-muted hover:text-navy",
        )}
      >
        हिन्दी
      </button>
    </div>
  );
}
