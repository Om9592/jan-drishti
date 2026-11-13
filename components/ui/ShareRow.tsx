"use client";

import { useState } from "react";
import { Link2, Check, Share2, MessageCircle, Twitter, Linkedin } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ShareRow({
  url,
  title,
  vertical = false,
}: {
  url: string;
  title: string;
  vertical?: boolean;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
    } else {
      void copy();
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const items = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: MessageCircle,
    },
    {
      key: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: Twitter,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: Linkedin,
    },
  ];

  return (
    <div className={vertical ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
      <span className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-ink-muted">
        {t("common.share")}
      </span>
      <div className={vertical ? "flex flex-col gap-1.5" : "flex items-center gap-1.5"}>
        {items.map(({ key, label, href, icon: Icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t("common.share")} — ${label}`}
            className="flex h-8 w-8 items-center justify-center border border-rule text-ink-soft transition-colors hover:border-navy hover:text-navy"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ))}
        <button
          type="button"
          onClick={copy}
          aria-label={t("common.copyLink")}
          className="flex h-8 w-8 items-center justify-center border border-rule text-ink-soft transition-colors hover:border-navy hover:text-navy"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-verdict-true" /> : <Link2 className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={nativeShare}
          className="flex h-8 items-center gap-1.5 border border-rule px-2 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-ink-soft transition-colors hover:border-navy hover:text-navy sm:hidden"
        >
          <Share2 className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? t("common.copied") : ""}
      </span>
    </div>
  );
}
