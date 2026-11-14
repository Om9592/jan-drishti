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

interface AiOptions {
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
  model?: string;
  /** Hard deadline per attempt. Structured pipeline calls set this explicitly. */
  timeoutMs?: number;
  /** "minimal" | "low" | "medium" | "high"; omitted when undefined. */
  reasoningEffort?: string | null;
  /** Retry once with a bigger budget when the answer was cut off mid-JSON. */
  retryOnTruncation?: boolean;
}

/** OpenAI-compatible chat completion. Returns null when no key is configured. */
export async function aiComplete(messages: AiMessage[], options?: AiOptions): Promise<{ text: string; model: string } | null> {
  if (!isAiConfigured()) return null;
  const first = await aiRequest(messages, options);
  // A dead provider (timeout, 5xx, network) is not worth a second wait: that
  // only doubles the latency of a request the editor is staring at.
  if (!first) return null;
  if (first.finishReason !== "length" && !looksTruncated(first.text)) return first;
  if (options?.retryOnTruncation === false) return first;
  /**
   * Reasoning-capable models spend part of the completion budget on internal
   * thinking and can return an empty `content` with finish_reason "length".
   * One retry with a much larger budget fixes that without guessing.
   */
  return aiRequest(messages, { ...options, maxTokens: Math.max((options?.maxTokens ?? 1800) * 2, 3000) });
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

function looksTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  let depth = 0;
  for (const char of trimmed) {
    if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth -= 1;
  }
  return depth !== 0;
}

async function aiRequest(messages: AiMessage[], options?: AiOptions): Promise<{ text: string; model: string; finishReason?: string } | null> {
  const model = options?.model ?? config.ai.model;
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const reasoningEffort = options?.reasoningEffort === undefined ? config.ai.reasoningEffort : options.reasoningEffort;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const payload = JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 1800,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    });
    let response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: payload,
      signal: controller.signal,
    });
    // Free-tier keys are rate limited per minute and the fleet is often busy:
    // one short pause is usually enough, and waiting is cheaper than giving up.
    for (const wait of [4000, 8000]) {
      if (response.ok || (response.status !== 429 && response.status < 500)) break;
      const jitter = wait + Math.floor(Math.random() * 1500);
      console.warn("[ai] busy", response.status, `- retrying in ${jitter}ms`);
      await new Promise((resolve) => setTimeout(resolve, jitter));
      response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.ai.apiKey}`,
        },
        body: payload,
        signal: controller.signal,
      });
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[ai] provider error", response.status, body.slice(0, 400));
      // Model ids get retired: say so loudly instead of returning "no answer".
      if (response.status === 404 && /model/i.test(body)) {
        throw new AiError(
          `The configured model "${model}" is not available to this API key. Set AI_MODEL to a model your key lists.`,
          404,
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new AiError("The AI provider rejected the API key.", response.status);
      }
      throw new AiError(`The AI provider returned HTTP ${response.status}.`, response.status);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (!text) {
      console.error("[ai] empty completion", choice?.finish_reason);
      throw new AiError(`The model returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"}).`, 502);
    }
    return { text, model, finishReason: choice?.finish_reason };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if ((error as Error)?.name === "AbortError") {
      console.error("[ai] timeout after", timeoutMs, "ms");
      throw new AiError(`The AI provider did not answer within ${Math.round(timeoutMs / 1000)}s.`, 408);
    }
    console.error("[ai] request failed", (error as Error)?.message ?? error);
    throw new AiError("The AI provider request failed (network error).", 502);
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
  try {
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
      { temperature: 0, maxTokens: 800, timeoutMs: 60_000, retryOnTruncation: false },
    );
    return result?.text ?? null;
  } catch (error) {
    console.error("[ocr] transcription failed", (error as Error)?.message ?? error);
    return null;
  }
}
