import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Language, Verdict } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0900-\u097F]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function readingTime(html: string, lang: Language = "en"): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  // Hindi is read slightly slower per "word" because of conjuncts.
  const wpm = lang === "hi" ? 170 : 230;
  return Math.max(1, Math.round(words / wpm));
}

export function formatDate(iso: string | null | undefined, lang: Language = "en", opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
    ...opts,
  }).format(date);
}

export function formatDateTime(iso: string | null | undefined, lang: Language = "en"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = lang === "hi" ? "hi-IN" : "en-IN";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short",
  }).format(date);
}

export function timeAgo(iso: string | null | undefined, lang: Language = "en"): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { numeric: "auto" });
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.round(months / 12), "year");
}

export const VERDICT_META: Record<Verdict, { en: string; hi: string; tone: string; description: string }> = {
  verified_true: {
    en: "Verified true",
    hi: "सत्य सत्यापित",
    tone: "text-verdict-true border-verdict-true/30 bg-verdict-true/[0.06]",
    description: "Multiple independent, primary sources confirm the claim as stated.",
  },
  false: {
    en: "False",
    hi: "असत्य",
    tone: "text-verdict-false border-verdict-false/30 bg-verdict-false/[0.06]",
    description: "The available evidence contradicts the claim.",
  },
  misleading: {
    en: "Misleading",
    hi: "भ्रामक",
    tone: "text-verdict-misleading border-verdict-misleading/30 bg-verdict-misleading/[0.06]",
    description: "Elements are accurate, but framing, scale or context misleads readers.",
  },
  unverified: {
    en: "Unverified",
    hi: "असत्यापित",
    tone: "text-verdict-unverified border-verdict-unverified/30 bg-verdict-unverified/[0.06]",
    description: "The record does not settle the claim either way.",
  },
  outdated: {
    en: "Outdated",
    hi: "पुराना",
    tone: "text-verdict-outdated border-verdict-outdated/30 bg-verdict-outdated/[0.06]",
    description: "The claim was once accurate but has been superseded.",
  },
  disputed: {
    en: "Disputed",
    hi: "विवादित",
    tone: "text-verdict-disputed border-verdict-disputed/30 bg-verdict-disputed/[0.06]",
    description: "Credible sources conflict and the record is contested.",
  },
};

export function verdictLabel(v: Verdict, lang: Language = "en"): string {
  return VERDICT_META[v][lang];
}

/** Strip any HTML that is not explicitly allowed. Used for user-authored content. */
export function sanitizeEditorialHtml(html: string): string {
  // Conservative allow-list sanitisation for dashboard-authored rich text.
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, length = 180): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length).replace(/\s+\S*$/, "")}…`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function absoluteUrl(path: string, siteUrl: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * perPage, current * perPage),
    page: current,
    totalPages,
    total,
  };
}

export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, "https://example.org");
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
