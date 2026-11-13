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
  // India
  { id: "th-national", publisher: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", categorySlug: "india" },
  { id: "ht-india", publisher: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml", categorySlug: "india" },
  { id: "ndtv-top", publisher: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", categorySlug: "india" },
  { id: "mint-news", publisher: "Mint", url: "https://www.livemint.com/rss/news", categorySlug: "india" },
  // Politics
  { id: "et-politics", publisher: "Economic Times", url: "https://economictimes.indiatimes.com/news/politics-and-nation/rssfeeds/1052732854.cms", categorySlug: "politics" },
  { id: "mint-politics", publisher: "Mint", url: "https://www.livemint.com/rss/politics", categorySlug: "politics" },
  // Economy
  { id: "th-business", publisher: "The Hindu", url: "https://www.thehindu.com/business/feeder/default.rss", categorySlug: "economy" },
  { id: "businessline", publisher: "BusinessLine", url: "https://www.thehindubusinessline.com/feeder/default.rss", categorySlug: "economy" },
  { id: "mint-economy", publisher: "Mint", url: "https://www.livemint.com/rss/economy", categorySlug: "economy" },
  { id: "rbi-press", publisher: "Reserve Bank of India", url: "https://rbi.org.in/pressreleases_rss.xml", categorySlug: "economy" },
  // Education / health / states
  { id: "th-education", publisher: "The Hindu", url: "https://www.thehindu.com/education/feeder/default.rss", categorySlug: "education" },
  { id: "th-health", publisher: "The Hindu", url: "https://www.thehindu.com/sci-tech/health/feeder/default.rss", categorySlug: "health" },
  { id: "th-states", publisher: "The Hindu", url: "https://www.thehindu.com/news/states/feeder/default.rss", categorySlug: "states" },
  { id: "ndtv-cities", publisher: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-cities-news", categorySlug: "states" },
  { id: "th-cities", publisher: "The Hindu", url: "https://www.thehindu.com/news/cities/feeder/default.rss", categorySlug: "states" },
  // Environment / science / technology
  { id: "mongabay", publisher: "Mongabay India", url: "https://india.mongabay.com/feed/", categorySlug: "environment" },
  { id: "th-environment", publisher: "The Hindu", url: "https://www.thehindu.com/sci-tech/energy-and-environment/feeder/default.rss", categorySlug: "environment" },
  { id: "th-science", publisher: "The Hindu", url: "https://www.thehindu.com/sci-tech/feeder/default.rss", categorySlug: "science" },
  { id: "th-science-deep", publisher: "The Hindu", url: "https://www.thehindu.com/sci-tech/science/feeder/default.rss", categorySlug: "science" },
  { id: "ht-tech", publisher: "Hindustan Times", url: "https://www.hindustantimes.com/feeds/rss/technology/rssfeed.xml", categorySlug: "technology" },
  { id: "toi-top", publisher: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms", categorySlug: "india" },
];

const MAX_PER_FEED = 14;
const MAX_AGE_DAYS = 6;
/** Section pages tolerate older items rather than showing an empty page. */
const SECTION_MAX_AGE_DAYS = 21;

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
  imageUrl: string | null;
}

/**
 * Wire thumbnails are hotlinked from the publisher's own CDN with visible
 * attribution — never re-uploaded, never presented as our photography.
 * Set WIRE_IMAGES=off to render text-only cards instead.
 */
const WIRE_IMAGES_ENABLED = process.env.WIRE_IMAGES !== "off";

function pickImage(block: string): string | null {
  const patterns = [
    /<media:content[^>]*url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]*url=["']([^"']+)["']/i,
    /<enclosure[^>]*type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i,
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']*["']/i,
    /<img[^>]*src=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match?.[1]) return decode(match[1]).trim();
  }
  return null;
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
        imageUrl: WIRE_IMAGES_ENABLED ? pickImage(block) : null,
      };
    })
    .filter((item) => item.title.length > 12 && /^https?:\/\//.test(item.link));
}

async function fetchFeed(feed: WireFeed, maxAgeDays = MAX_AGE_DAYS): Promise<Article[]> {
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
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
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
          imageUrl: item.imageUrl,
          imageCredit: item.imageUrl ? `Photo: ${feed.publisher}` : undefined,
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
export const getWireArticles = cache(async (limit = 40, maxAgeDays = MAX_AGE_DAYS): Promise<Article[]> => {
  const results = await Promise.all(WIRE_FEEDS.map((feed) => fetchFeed(feed, maxAgeDays)));
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
  // Fetch only the feeds mapped to this section.
  //
  // Slicing a global "newest N" pool used to leave niche beats blank: the top
  // of the pool is almost always general news, and a section feed that has not
  // rebuilt for a week (The Hindu's States feed sat at 4 Nov for nine days)
  // never made the cut. Section feeds also get a longer freshness window —
  // items still carry their own date and publisher, so nothing is passed off
  // as today's news.
  const feeds = WIRE_FEEDS.filter((feed) => feed.categorySlug === categorySlug);
  if (feeds.length === 0) return [];
  const results = await Promise.all(feeds.map((feed) => fetchFeed(feed, SECTION_MAX_AGE_DAYS)));
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

/** Publishers currently represented on the wire — used for the disclosure line. */
export const getWirePublishers = cache(async (): Promise<string[]> => {
  const items = await getWireArticles(250);
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
