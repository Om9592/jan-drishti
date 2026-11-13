import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import type { Article } from "@/lib/types";
import { stripHtml, truncate } from "@/lib/utils";

/**
 * The wire: headlines from trusted publishers, cached and refreshed continuously.
 *
 * Rules this module follows, deliberately:
 *  - Only headline, a short attributed summary, publisher name and the canonical link
 *    are stored. Never full article text, never publisher photography.
 *  - Every item is `kind: "external"` and links out to the publisher, so a reader can
 *    never mistake someone else's reporting for Jan Drishti's.
 *  - If a feed is down, it is skipped and logged. Nothing is invented to fill a gap.
 *  - Nothing here is a fact-check verdict, and nothing here is presented as verified
 *    by this newsroom.
 */

export interface WireFeed {
  /** Short identifier used for logging and de-duplication. */
  id: string;
  /** Publisher as it appears to readers. */
  publisher: string;
  url: string;
  categorySlug: string;
}

export const WIRE_FEEDS: WireFeed[] = [
  { id: "th-national", publisher: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", categorySlug: "india" },
  { id: "th-business", publisher: "The Hindu", url: "https://www.thehindu.com/business/feeder/default.rss", categorySlug: "economy" },
  { id: "th-education", publisher: "The Hindu", url: "https://www.thehindu.com/education/feeder/default.rss", categorySlug: "education" },
  { id: "th-health", publisher: "The Hindu", url: "https://www.thehindu.com/sci-tech/health/feeder/default.rss", categorySlug: "health" },
  { id: "th-states", publisher: "The Hindu", url: "https://www.thehindu.com/news/states/feeder/default.rss", categorySlug: "states" },
  { id: "mint-news", publisher: "Mint", url: "https://www.livemint.com/rss/news", categorySlug: "india" },
  { id: "mint-politics", publisher: "Mint", url: "https://www.livemint.com/rss/politics", categorySlug: "politics" },
  { id: "mint-economy", publisher: "Mint", url: "https://www.livemint.com/rss/economy", categorySlug: "economy" },
  { id: "ndtv-top", publisher: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", categorySlug: "india" },
  { id: "rbi-press", publisher: "Reserve Bank of India", url: "https://rbi.org.in/pressreleases_rss.xml", categorySlug: "economy" },
];

const MAX_PER_FEED = 12;
const MAX_AGE_DAYS = 6;

function decode(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function pick(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decode(match[1]!).trim() : null;
}

interface ParsedItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
}

function parse(xml: string): ParsedItem[] {
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  return blocks
    .map((block) => {
      const rawDate = pick(block, "pubDate") ?? pick(block, "published") ?? pick(block, "updated");
      const parsedDate = rawDate ? new Date(rawDate) : null;
      return {
        title: stripHtml(pick(block, "title") ?? "").trim(),
        link: (pick(block, "link") ?? block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? "").trim(),
        summary: truncate(
          stripHtml(pick(block, "description") ?? pick(block, "summary") ?? "").trim(),
          240,
        ),
        publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      };
    })
    .filter((item) => item.title.length > 12 && /^https?:\/\//.test(item.link));
}

async function fetchFeed(feed: WireFeed): Promise<Article[]> {
  try {
    const response = await fetch(feed.url, {
      // The data cache refreshes every ten minutes, so the page stays current
      // without a request-time stampede at the publishers.
      next: { revalidate: 600 },
      headers: {
        "User-Agent": "JanDrishti/1.0 (+https://jan-drishti-navy.vercel.app; headline aggregation)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      console.warn(`[wire] ${feed.id} returned ${response.status}`);
      return [];
    }
    const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
    return parse(await response.text())
      .slice(0, MAX_PER_FEED)
      .filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= cutoff)
      .map((item) => {
        const publishedAt = item.publishedAt ?? new Date().toISOString();
        const id = createHash("sha256").update(item.link).digest("hex").slice(0, 16);
        return {
          id: `wire-${id}`,
          slug: "",
          title: item.title,
          summary: item.summary || item.title,
          content: "",
          language: "en" as const,
          categoryId: feed.id,
          categorySlug: feed.categorySlug,
          authorId: "wire",
          authorName: feed.publisher,
          imageUrl: null,
          status: "published" as const,
          kind: "external" as const,
          publishedAt,
          updatedAt: publishedAt,
          sourceUrl: item.link,
          sourceName: feed.publisher,
          tags: [],
          isSample: false,
        } satisfies Article;
      });
  } catch (error) {
    console.warn(`[wire] ${feed.id} unavailable: ${(error as Error).message}`);
    return [];
  }
}

function canonicalKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return url;
  }
}

/** All wire items, newest first. Deduplicated across feeds, capped. */
export const getWireArticles = cache(async (limit = 40): Promise<Article[]> => {
  const results = await Promise.all(WIRE_FEEDS.map(fetchFeed));
  const seen = new Set<string>();
  const items: Article[] = [];
  for (const article of results.flat()) {
    const key = canonicalKey(article.sourceUrl ?? article.title);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(article);
  }
  items.sort((a, b) => Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0"));
  return items.slice(0, limit);
});

/** Wire items for one section, optionally with a per-section cap. */
export const getWireForCategory = cache(async (categorySlug: string, limit = 8): Promise<Article[]> => {
  const items = await getWireArticles(80);
  return items.filter((item) => item.categorySlug === categorySlug).slice(0, limit);
});

/** Publishers currently represented on the wire — used for the disclosure line. */
export const getWirePublishers = cache(async (): Promise<string[]> => {
  const items = await getWireArticles(80);
  return Array.from(new Set(items.map((item) => item.sourceName ?? "").filter(Boolean))).sort();
});

/**
 * Own reporting first, then the wire. Never mixes the two silently: every wire
 * item carries `kind: "external"` and links to the publisher.
 */
export function mergeWithWire(own: Article[], wire: Article[], limit: number): Article[] {
  const seen = new Set(own.map((article) => canonicalKey(article.slug)));
  const merged = [...own];
  for (const item of wire) {
    if (merged.length >= limit) break;
    const key = canonicalKey(item.sourceUrl ?? item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, limit);
}
