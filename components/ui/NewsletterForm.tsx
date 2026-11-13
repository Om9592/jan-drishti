"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function NewsletterForm({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: boolean; alreadySubscribed?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setState("error");
        setMessage(data.error ?? t("newsletter.error"));
        return;
      }
      setState("done");
      setMessage(data.alreadySubscribed ? t("newsletter.thanks") : t("newsletter.thanks"));
      setEmail("");
    } catch {
      setState("error");
      setMessage(t("newsletter.error"));
    }
  }

  const dark = tone === "dark";

  return (
    <div>
      <form onSubmit={submit} className="flex items-stretch">
        <label className="sr-only" htmlFor="newsletter-email">
          {t("common.email")}
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("home.newsletter.placeholder")}
          className={
            dark
              ? "w-full border border-paper/30 bg-transparent px-3 py-2.5 font-sans text-[0.85rem] text-paper outline-none placeholder:text-paper/40 focus:border-gold"
              : "w-full border border-rule-strong bg-white px-3 py-2.5 font-sans text-[0.85rem] text-ink outline-none placeholder:text-ink-muted/60 focus:border-navy"
          }
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={
            dark
              ? "flex shrink-0 items-center gap-1.5 border border-gold bg-gold px-4 font-sans text-[0.65rem] uppercase tracking-[0.1em] text-navy-900 transition-colors hover:bg-gold-dark hover:text-paper disabled:opacity-60"
              : "flex shrink-0 items-center gap-1.5 bg-navy px-4 font-sans text-[0.65rem] uppercase tracking-[0.1em] text-paper transition-colors hover:bg-navy-700 disabled:opacity-60"
          }
        >
          {state === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{t("home.newsletter.cta")}</span>
        </button>
      </form>
      <p
        className={`mt-2 font-sans text-[0.68rem] ${dark ? "text-paper/50" : "text-ink-muted"}`}
        role="status"
        aria-live="polite"
      >
        {message ?? t("home.newsletter.note")}
      </p>
    </div>
  );
}
