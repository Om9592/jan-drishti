import "server-only";
import { getWireArticles } from "@/lib/ingestion/wire";
import type { SearchHit } from "@/lib/research/providers";

/**
 * Keyless evidence retrievers.
 *
 * The paid search APIs (Tavily / Brave / Serper) are optional. Without a key the
 * desk used to run no search at all, which meant "AI fact-check" silently
 * degraded to nothing. These retrievers need no credentials, so evidence
 * gathering always runs:
 *
 *   - Google News RSS  — many Indian publishers per query, with dates
 *   - Bing News RSS    — a second, independent index
 *   - the wire pool    — the trusted feeds already fetched for the site
 *   - Wikipedia        — background on named entities (never a verdict source)
 *
 * Everything returned here is a real, openable URL. Nothing is invented: if a
 * retriever fails, it returns nothing and the step is reported as unavailable.
 */

const UA = "JanDrishti/1.0 (+https://jan-drishti-navy.vercel.app; fact-check evidence retrieval)";

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

function stripTags(text: string): string {
  return decode(text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? stripTags(match[1]) : null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
      // Evidence must be fresh when an editor asks for it — no long-lived cache.
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[retrieval] ${hostOf(url)} responded ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(`[retrieval] ${hostOf(url)} failed: ${(error as Error).message}`);
    return null;
  }
}

async function googleNewsFeed(query: string): Promise<SearchHit[]> {
  // A Hindi claim has to be searched in the Hindi edition, or the reader's own
  // words match nothing: Google returns English headlines only.
  const hindi = /[\u0900-\u097F]/.test(query);
  const locale = hindi ? "hl=hi-IN&gl=IN&ceid=IN:hi" : "hl=en-IN&gl=IN&ceid=IN:en";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .map((block) => {
      const rawTitle = tag(block, "title") ?? "";
      const source = tag(block, "source");
      const link = tag(block, "link") ?? "";
      // Google repeats the outlet in the headline: "Headline - Publisher".
      const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
      return {
        title,
        url: link,
        snippet: tag(block, "description") ?? title,
        publisher: source ?? hostOf(link),
        publishedAt: toIso(tag(block, "pubDate")),
      } satisfies SearchHit;
    })
    .filter((hit) => hit.title.length > 10 && /^https?:\/\//.test(hit.url));
}

/**
 * Google News RSS — free, keyless, and multi-publisher.
 *
 * Recency is the point: a claim asked today should be checked against this
 * week's reporting, not a two-year-old explainer. The window operator narrows
 * the index first; if that leaves too little to corroborate, the plain query
 * runs as well so a genuinely rare claim is not reported as unchecked.
 */
export async function googleNewsSearch(query: string, limit = 8, windowDays: number | null = 7): Promise<SearchHit[]> {
  const windowed = windowDays ? await googleNewsFeed(`${query} when:${windowDays}d`) : [];
  if (windowed.length >= 3) return windowed.slice(0, limit);
  const recent = windowed;
  const plain = await googleNewsFeed(query);
  const seen = new Set(recent.map((hit) => hit.url.split("?")[0]));
  return [...recent, ...plain.filter((hit) => !seen.has(hit.url.split("?")[0]))].slice(0, limit);
}

/** Bing News RSS — a second index, so results are not single-sourced. */
export async function bingNewsSearch(query: string, limit = 8): Promise<SearchHit[]> {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS&setmkt=en-IN&qft=sortbydate%3d%221%22`;
  const xml = await fetchText(url);
  if (!xml) return [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .map((block) => {
      const link = tag(block, "link") ?? "";
      return {
        title: tag(block, "title") ?? "",
        url: link,
        snippet: tag(block, "description") ?? "",
        publisher: hostOf(link),
        publishedAt: toIso(tag(block, "pubDate")),
      } satisfies SearchHit;
    })
    .filter((hit) => hit.title.length > 10 && /^https?:\/\//.test(hit.url))
    .slice(0, limit);
}

/** Search the trusted feeds the site already ingests, in memory. */
export async function wireSearch(query: string, limit = 6): Promise<SearchHit[]> {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 3)
    .slice(0, 8);
  if (tokens.length === 0) return [];

  const items = await getWireArticles(250, 21);
  const scored = items
    .map((article) => {
      const haystack = `${article.title} ${article.summary}`.toLowerCase();
      const hits = tokens.filter((token) => haystack.includes(token)).length;
      return { article, hits };
    })
    // Two matching terms is enough to surface a related headline: the point of
    // this retriever is recall, the editor judges relevance.
    .filter((row) => row.hits >= Math.min(2, tokens.length))
    .sort((a, b) => b.hits - a.hits || Date.parse(b.article.publishedAt ?? "0") - Date.parse(a.article.publishedAt ?? "0"))
    .slice(0, limit);

  return scored.map(({ article }) => ({
    title: article.title,
    url: article.sourceUrl ?? "",
    snippet: article.summary,
    publisher: article.sourceName ?? article.authorName ?? hostOf(article.sourceUrl ?? ""),
    publishedAt: article.publishedAt,
  }));
}

/** Wikipedia — background only. Never used on its own to support a verdict. */
export async function wikipediaSearch(query: string, limit = 3): Promise<SearchHit[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const raw = await fetchText(url, 9000);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { query?: { search?: { title: string; snippet: string }[] } };
    return (data.query?.search ?? []).map((row) => ({
      title: row.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.title.replace(/\s+/g, "_"))}`,
      snippet: stripTags(row.snippet),
      publisher: "Wikipedia",
      publishedAt: null,
    }));
  } catch {
    return [];
  }
}

export interface RetrievalSummary {
  hits: SearchHit[];
  /** Names of the retrievers that actually returned something. */
  used: string[];
  /** Retrievers that ran and returned nothing, or failed. */
  empty: string[];
}

/**
 * Run every keyless retriever in parallel and de-duplicate by URL and by
 * headline. Independent publishers are what the verdict gate counts, so a
 * single syndicated story repeated five times must not look like five sources.
 */
export async function retrieveEvidence(
  queries: string[],
  perQuery = 8,
  /** null widens the search beyond the recent window, for claims about older events. */
  windowDays: number | null = 7,
): Promise<RetrievalSummary> {
  const rooms = queries.slice(0, 4);
  const used = new Set<string>();
  const empty = new Set<string>();
  const byUrl = new Map<string, SearchHit>();
  const byTitle = new Set<string>();

  const jobs: { name: string; run: () => Promise<SearchHit[]> }[] = [];
  for (const query of rooms) {
    jobs.push({ name: "google-news", run: () => googleNewsSearch(query, perQuery, windowDays) });
    jobs.push({ name: "bing-news", run: () => bingNewsSearch(query, perQuery) });
    jobs.push({ name: "trusted-wire", run: () => wireSearch(query, 4) });
  }
  jobs.push({ name: "wikipedia", run: () => wikipediaSearch(rooms[0] ?? "", 3) });

  /**
   * Every fetch is capped: one slow feed must not eat the model's share of the
   * request budget, which is what made checks come back with no verdict.
   */
  const cap = (promise: Promise<SearchHit[]>, ms: number): Promise<SearchHit[]> =>
    Promise.race([
      promise.catch(() => [] as SearchHit[]),
      new Promise<SearchHit[]>((resolve) => setTimeout(() => resolve([]), ms)),
    ]);
  const results = await Promise.all(
    jobs.map(async (job) => {
      const hits = await cap(job.run(), windowDays === null ? 6_000 : 8_000);
      return { name: job.name, hits };
    }),
  );

  for (const { name, hits } of results) {
    if (hits.length === 0) {
      empty.add(name);
      continue;
    }
    used.add(name);
    for (const hit of hits) {
      const urlKey = hit.url.split("?")[0].toLowerCase();
      const titleKey = hit.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 90);
      if (byUrl.has(urlKey) || byTitle.has(titleKey)) continue;
      byUrl.set(urlKey, hit);
      byTitle.add(titleKey);
    }
  }

  // Newest first: the verdict should be about what is being reported now.
  const hits = Array.from(byUrl.values()).sort(
    (a, b) => Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0"),
  );
  return { hits, used: Array.from(used), empty: Array.from(empty) };
}

/** Distinct publishers in a hit set — the number that matters for corroboration. */
export function independentPublishers(hits: { url: string; publisher?: string }[]): string[] {
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = (hit.publisher ?? hostOf(hit.url) ?? "").toLowerCase().replace(/^www\./, "");
    if (key) seen.add(key);
  }
  return Array.from(seen).sort();
}
