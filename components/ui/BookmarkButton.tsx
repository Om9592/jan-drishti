"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  articleId,
  initialSaved = false,
  signedIn,
  className,
}: {
  articleId: string;
  initialSaved?: boolean;
  signedIn: boolean;
  className?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const data = (await res.json()) as { ok: boolean; saved?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setSaved(!nextSaved);
        setMessage(data.error ?? t("common.error"));
        return;
      }
      setSaved(Boolean(data.saved));
      setMessage(data.saved ? t("common.saved") : null);
      startTransition(() => router.refresh());
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setSaved(!nextSaved);
      setMessage(t("common.error"));
    }
  }

  return (
    <div className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        className={cn(
          "inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-sans text-[0.62rem] uppercase tracking-[0.1em] transition-colors",
          saved ? "border-navy bg-navy text-paper" : "border-rule text-ink-soft hover:border-navy hover:text-navy",
        )}
      >
        {saved ? <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />}
        {saved ? t("common.saved") : t("common.save")}
      </button>
      <span className="min-h-[0.75rem] font-sans text-[0.62rem] text-ink-muted" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
