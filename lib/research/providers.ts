import "server-only";
import { config, isAiConfigured, isSearchConfigured } from "@/lib/config";
import type { SourceType } from "@/lib/types";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publisher?: string;
  publishedAt?: string | null;
  sourceType?: SourceType;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Classify a source by hostname so evidence is never flattened into one bucket. */
export function classifySource(url: string): SourceType {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
  const government = /(^|\.)(gov\.in|nic\.in|gov\.uk|gov)$/;
  const judiciary = /(^|\.)(sci\.gov\.in|indiankanoon\.org|judiciary)/;
  const research = /(^|\.)(org\.in|ac\.in|edu|who\.int|un\.org|imf\.org|worldbank\.org)$/;
  const social = /(twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|whatsapp\.com|t\.me)$/;
  const press = /(thehindu|indianexpress|hindustantimes|scroll|wire|quint|ndtv|bbc|reuters|apnews|ptinews|business-standard|livemint|downtoearth)/;

  if (judiciary.test(host)) return "primary_record";
  if (government.test(host)) return "government";
  if (social.test(host)) return "social_media";
  if (press.test(host)) return "independent_journalism";
  if (research.test(host)) return "research";
  return "other";
}

export function isGovernmentSource(url: string): boolean {
  return ["government", "primary_record"].includes(classifySource(url));
}

/** OpenAI-compatible chat completion. Returns null when no key is configured. */
export async function aiComplete(
  messages: AiMessage[],
  options?: { temperature?: number; json?: boolean; maxTokens?: number; model?: string },
): Promise<{ text: string; model: string } | null> {
  if (!isAiConfigured()) return null;
  const model = options?.model ?? config.ai.model;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1800,
        ...(options?.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[ai] provider error", response.status, await response.text().catch(() => ""));
      return null;
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;
    return { text, model };
  } catch (error) {
    console.error("[ai] request failed", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Web search across configured providers. Never fabricates results. */
export async function webSearch(query: string, limit = 6): Promise<SearchHit[]> {
  if (!isSearchConfigured()) return [];

  if (config.search.tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: config.search.tavilyKey,
          query,
          max_results: limit,
          search_depth: "advanced",
          include_answer: false,
          include_raw_content: false,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: { title: string; url: string; content: string; published_date?: string }[];
        };
        return (data.results ?? []).slice(0, limit).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.slice(0, 900) ?? "",
          publishedAt: r.published_date ?? null,
          sourceType: classifySource(r.url),
        }));
      }
    } catch (error) {
      console.error("[search] tavily failed", error);
    }
  }

  if (config.search.braveKey) {
    try {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(limit));
      const res = await fetch(url, {
        headers: { "X-Subscription-Token": config.search.braveKey, Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          web?: { results?: { title: string; url: string; description: string; age?: string }[] };
        };
        return (data.web?.results ?? []).slice(0, limit).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.description ?? "",
          publishedAt: r.age ?? null,
          sourceType: classifySource(r.url),
        }));
      }
    } catch (error) {
      console.error("[search] brave failed", error);
    }
  }

  if (config.search.serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": config.search.serperKey },
        body: JSON.stringify({ q: query, num: limit }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          organic?: { title: string; link: string; snippet: string; date?: string }[];
        };
        return (data.organic ?? []).slice(0, limit).map((r) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet ?? "",
          publishedAt: r.date ?? null,
          sourceType: classifySource(r.link),
        }));
      }
    } catch (error) {
      console.error("[search] serper failed", error);
    }
  }

  return [];
}

/**
 * OCR for submitted screenshots. Uses a vision-capable model when configured.
 * Returns null (never a guess) when OCR is unavailable.
 */
export async function extractImageText(base64: string, mime: string): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const result = await aiComplete(
    [
      {
        role: "system",
        content:
          "You transcribe text from images for a fact-checking desk. Transcribe exactly, in the original language and script. Do not summarise, correct or interpret. If there is no legible text, reply with an empty string.",
      },
      {
        role: "user",
        content: `Transcribe all legible text from this image.\n\n![image](data:${mime};base64,${base64})`,
      },
    ],
    { temperature: 0, maxTokens: 800 },
  );
  return result?.text ?? null;
}
