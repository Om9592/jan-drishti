import "server-only";
import { createHash } from "node:crypto";
import { adminDb, COLLECTIONS } from "@/lib/firebase/admin";
import { getStore } from "@/lib/store";
import type { FeedSource, Language } from "@/lib/types";
import { slugify, stripHtml, truncate } from "@/lib/utils";

/**
 * News ingestion.
 *
 * Copyright-safe by construction: we store the headline, a short attributed
 * summary and the canonical link — never full article text. Republished
 * reports are marked `kind: "external"` and carry the publisher name, so the
 * reader always knows whose reporting they are reading.
 *
 * Every ingested item lands in `status: "review"`. Nothing auto-publishes.
 */

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  guid: string;
}

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeEntities(match[1]!).trim() : null;
}

export function parseFeed(xml: string): FeedItem[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  return blocks
    .map((block) => {
      const title = tag(block, "title") ?? "";
      const isAtom = /<entry/i.test(block);
      const linkMatch = isAtom
        ? block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1]
        : tag(block, "link");
      const description =
        tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content:encoded") ?? "";
      const pubDate = tag(block, "pubDate") ?? tag(block, "updated") ?? tag(block, "published");
      return {
        title: stripHtml(title),
        link: (linkMatch ?? "").trim(),
        description: truncate(stripHtml(description), 600),
        pubDate: pubDate ? new Date(pubDate).toISOString() : null,
        guid: tag(block, "guid") ?? (linkMatch ?? title),
      };
    })
    .filter((item) => item.title && /^https?:\/\//.test(item.link));
}

export function detectLanguage(text: string): Language {
  const devanagari = (text.match(/[\u0900-\u097F]/g) ?? []).length;
  return devanagari > text.length * 0.15 ? "hi" : "en";
}

const CATEGORY_RULES: { slug: string; keywords: string[] }[] = [
  { slug: "politics", keywords: ["parliament", "lok sabha", "rajya sabha", "election", "minister", "bill", "governor", "party"] },
  { slug: "economy", keywords: ["gdp", "inflation", "rbi", "rupee", "budget", "tax", "employment", "jobs", "trade"] },
  { slug: "education", keywords: ["school", "exam", "university", "ugc", "cbse", "student", "teacher"] },
  { slug: "health", keywords: ["hospital", "health", "vaccine", "disease", "doctor", "icmr", "ayushman"] },
  { slug: "environment", keywords: ["climate", "pollution", "forest", "monsoon", "river", "emission", "wildlife"] },
  { slug: "science", keywords: ["isro", "research", "study", "satellite", "scientist"] },
  { slug: "technology", keywords: ["ai", "internet", "data protection", "platform", "semiconductor", "digital"] },
  { slug: "states", keywords: ["district", "state government", "collector", "panchayat", "municipal"] },
];

export function assignCategory(text: string): string {
  const hay = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => hay.includes(k))) return rule.slug;
  }
  return "india";
}

async function robotsAllows(url: string): Promise<boolean> {
  try {
    const target = new URL(url);
    const robots = await fetch(`${target.origin}/robots.txt`, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "JanDrishtiBot/1.0 (+https://jan-drishti.vercel.app/about)" },
    });
    if (!robots.ok) return true;
    const body = await robots.text();
    const lines = body.split("\n").map((l) => l.trim());
    let appliesToUs = lines.some((l) => /^user-agent:\s*\*/i.test(l) || /user-agent:\s*jandrishtibot/i.test(l));
    if (!appliesToUs) return true;
    for (const line of lines) {
      const match = line.match(/^disallow:\s*(\S*)/i);
      if (match && match[1] && target.pathname.startsWith(match[1])) return false;
    }
    return true;
  } catch {
    return false; // Fail closed: do not fetch when robots policy cannot be read.
  }
}

export interface IngestResult {
  sourceId: string;
  sourceName: string;
  fetched: number;
  created: number;
  skipped: number;
  duplicates: number;
  status: "ok" | "error" | "skipped";
  message?: string;
}

export async function ingestSource(source: FeedSource): Promise<IngestResult> {
  const base: IngestResult = {
    sourceId: source.id,
    sourceName: source.name,
    fetched: 0,
    created: 0,
    skipped: 0,
    duplicates: 0,
    status: "ok",
  };

  if (!source.enabled) return { ...base, status: "skipped", message: "Source disabled." };
  if (!(await robotsAllows(source.url))) {
    return { ...base, status: "skipped", message: "robots.txt disallows fetching this feed." };
  }

  let xml: string;
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "JanDrishtiBot/1.0 (+https://jan-drishti.vercel.app/about)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { ...base, status: "error", message: `Feed returned HTTP ${response.status}.` };
    }
    xml = await response.text();
  } catch (error) {
    return { ...base, status: "error", message: error instanceof Error ? error.message : "Fetch failed." };
  }

  const items = parseFeed(xml).slice(0, 25);
  base.fetched = items.length;

  const store = getStore();
  const categories = await store.listCategories();
  const db = adminDb();
  if (!db) {
    return {
      ...base,
      status: "skipped",
      message: "Firestore is not configured — ingestion writes require a database. Nothing was imported.",
    };
  }

  for (const item of items) {
    const fingerprint = createHash("sha256").update(item.link).digest("hex").slice(0, 24);
    const existing = await db.collection(COLLECTIONS.articles).where("fingerprint", "==", fingerprint).limit(1).get();
    if (!existing.empty) {
      base.duplicates += 1;
      continue;
    }

    const text = `${item.title} ${item.description}`;
    const categorySlug = assignCategory(text);
    const category = categories.find((c) => c.slug === categorySlug) ?? categories[0];
    if (!category) {
      base.skipped += 1;
      continue;
    }

    const docRef = db.collection(COLLECTIONS.articles).doc();
    await docRef.set({
      slug: `${slugify(item.title)}-${fingerprint.slice(0, 6)}`,
      title: item.title,
      subtitle: "",
      summary: truncate(item.description || item.title, 320),
      content: `<p>${truncate(item.description || item.title, 500)}</p><p><em>This is a headline summary of reporting published by ${source.publisher}. Read the original at <a href="${item.link}" rel="nofollow noopener">${source.publisher}</a>.</em></p>`,
      language: detectLanguage(text),
      categoryId: category.id,
      categorySlug: category.slug,
      authorId: "wire-desk",
      authorName: source.publisher,
      imageUrl: null,
      status: "review",
      kind: "external",
      state: null,
      tags: [],
      keywords: slugify(text).split("-").filter((t) => t.length > 2).slice(0, 20),
      fingerprint,
      sourceUrl: item.link,
      sourceName: source.publisher,
      sourceIds: [source.id],
      sources: [
        {
          id: source.id,
          name: source.name,
          url: source.url,
          publisher: source.publisher,
          publishedAt: item.pubDate,
          accessedAt: new Date().toISOString(),
          type: source.type,
          isPrimary: source.type === "government" || source.type === "primary_record",
        },
      ],
      featured: false,
      underreported: false,
      groundReport: false,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readingMinutes: 2,
      isSample: false,
    });
    base.created += 1;
  }

  await store.saveSource({
    ...source,
    lastFetchedAt: new Date().toISOString(),
    lastStatus: "ok",
  });
  await store.appendAudit({
    action: "ingestion.run",
    actorId: "system",
    targetType: "source",
    targetId: source.id,
    summary: `Ingested ${base.created} new item(s), ${base.duplicates} duplicate(s) skipped from ${source.name}.`,
  });

  return base;
}

export async function ingestAll(enabledOnly = true): Promise<IngestResult[]> {
  const store = getStore();
  const sources = (await store.listSources()).filter((s) => (enabledOnly ? s.enabled : true));
  const results: IngestResult[] = [];
  for (const source of sources) {
    results.push(await ingestSource(source));
  }
  return results;
}
