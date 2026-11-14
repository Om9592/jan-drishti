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
  /** Hard deadline for the whole call, across every provider in the chain. */
  timeoutMs?: number;
  /** "minimal" | "low" | "medium" | "high"; omitted when undefined. */
  reasoningEffort?: string | null;
  /** Retry once with a bigger budget when the answer was cut off mid-JSON. */
  retryOnTruncation?: boolean;
  /** Try this provider first (used to hand the re-check to a specific model). */
  prefer?: string;
}

export interface AiAnswer {
  text: string;
  model: string;
  provider: string;
  finishReason?: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Milliseconds the provider asked us to wait before trying again. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/**
 * OpenAI-compatible chat completion with provider failover.
 *
 * The chain is tried in order: a free key that hit its daily cap, a retired
 * model id, a timeout or a 5xx all hand the work to the next provider instead
 * of failing the run. When everything fails the error names every provider and
 * every reason, so an editor can tell "quota" from "bad key".
 */
export async function aiComplete(messages: AiMessage[], options?: AiOptions): Promise<AiAnswer | null> {
  const chain = options?.prefer
    ? [
        ...config.ai.chain.filter((endpoint) => endpoint.name === options.prefer),
        ...config.ai.chain.filter((endpoint) => endpoint.name !== options.prefer),
      ]
    : config.ai.chain;
  if (chain.length === 0) return null;

  const budget = options?.timeoutMs ?? 60_000;
  const deadline = Date.now() + budget;
  const failures: string[] = [];

  for (let index = 0; index < chain.length; index += 1) {
    const endpoint = chain[index];
    const remaining = deadline - Date.now();
    if (remaining < 5_000) {
      failures.push(`${endpoint.label}: skipped, no time left`);
      continue;
    }
    // The primary keeps most of the budget because it is the best model; the
    // fallbacks need far less to answer the same small JSON.
    const endpointsLeft = chain.length - index;
    const slice =
      endpointsLeft === 1
        ? remaining
        : Math.min(remaining, index === 0 ? Math.max(20_000, Math.round(remaining * 0.75)) : 45_000);

    try {
      const answer = await attempt(endpoint, messages, options, Math.min(slice, remaining));
      if (answer) return answer;
      failures.push(`${endpoint.label}: no answer`);
    } catch (error) {
      const failure = error as AiError;
      failures.push(`${endpoint.label}: ${failure.message}`);
      // A keyless endpoint that is merely waiting its turn is worth waiting for.
      if (failure.retryAfterMs && failure.retryAfterMs <= 45_000) {
        const left = deadline - Date.now() - failure.retryAfterMs;
        if (left > 5_000) {
          console.warn(`[ai] ${endpoint.name} is rate limited, waiting ${Math.round(failure.retryAfterMs / 1000)}s`);
          await new Promise((resolve) => setTimeout(resolve, failure.retryAfterMs));
          try {
            const answer = await attempt(endpoint, messages, options, Math.min(45_000, deadline - Date.now()));
            if (answer) return answer;
          } catch (retryError) {
            failures.push(`${endpoint.label}: ${(retryError as Error).message}`);
          }
        }
      }
    }
  }

  throw new AiError(`No AI provider answered. ${failures.join(" | ")}`, 502);
}

/** One provider, one deadline, plus a truncation retry. Never throws null-ish. */
async function attempt(
  endpoint: AiEndpointT,
  messages: AiMessage[],
  options: AiOptions | undefined,
  timeoutMs: number,
): Promise<AiAnswer | null> {
  const first = await aiRequest(endpoint, messages, options, timeoutMs);
  if (!first) return null;
  if (first.finishReason !== "length" && !looksTruncated(first.text)) return first;
  if (options?.retryOnTruncation === false) return first;
  /**
   * Reasoning-capable models spend part of the completion budget on internal
   * thinking and can return an empty `content` with finish_reason "length".
   * One retry with a much larger budget fixes that without guessing.
   */
  return aiRequest(endpoint, messages, { ...options, maxTokens: Math.max((options?.maxTokens ?? 1800) * 2, 3000) }, timeoutMs);
}

type AiEndpointT = (typeof config.ai.chain)[number];

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

async function aiRequest(
  endpoint: AiEndpointT,
  messages: AiMessage[],
  options: AiOptions | undefined,
  timeoutMs: number,
): Promise<AiAnswer | null> {
  const model = options?.model ?? endpoint.model;
  const requestedEffort = options?.reasoningEffort === undefined ? config.ai.reasoningEffort : options.reasoningEffort;
  // Open-weights servers disagree about the scale: Harmony takes high/medium/low
  // and rejects "minimal" outright, so map it down instead of losing the call.
  const reasoningEffort =
    requestedEffort === "minimal" && endpoint.keyless ? "low" : requestedEffort;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (endpoint.apiKey) headers.Authorization = `Bearer ${endpoint.apiKey}`;
  try {
    const payload = (effort: string | null | undefined) =>
      JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1800,
        ...(effort ? { reasoning_effort: effort } : {}),
        ...(options?.json ? { response_format: { type: "json_object" } } : {}),
      });
    const send = (effort: string | null | undefined = reasoningEffort) =>
      fetch(`${endpoint.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: payload(effort),
        signal: controller.signal,
      });

    let response = await send();
    // Free tiers are rate limited per minute and the fleet is often busy: one
    // short pause is usually enough, and waiting is cheaper than giving up.
    for (const wait of [4000, 8000]) {
      if (response.ok || (response.status !== 429 && response.status < 500)) break;
      const jitter = wait + Math.floor(Math.random() * 1500);
      console.warn(`[ai] ${endpoint.name} busy`, response.status, `- retrying in ${jitter}ms`);
      await new Promise((resolve) => setTimeout(resolve, jitter));
      response = await send();
    }
    if (response.status === 400) {
      // Some servers reject the parameter name rather than its value; the JSON
      // answer does not need it, so ask again without it before giving up.
      const probe = await response.clone().text().catch(() => "");
      if (/reasoning_effort/i.test(probe)) {
        console.warn(`[ai] ${endpoint.name} rejected reasoning_effort, retrying without it`);
        response = await send(null);
      }
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[ai] ${endpoint.name} error`, response.status, body.slice(0, 400));
      // Model ids get retired: say so loudly instead of returning "no answer".
      if (response.status === 404 && /model/i.test(body)) {
        throw new AiError(
          `The model "${model}" is not available to this key. Set the provider's model env var to one it lists.`,
          404,
        );
      }
      if (response.status === 401 || response.status === 403) {
        throw new AiError("The provider rejected the API key.", response.status);
      }
      if (response.status === 413) {
        throw new AiError(
          "The request is larger than this model's per-minute token limit (free tiers are small). Shorter evidence or a bigger tier fixes it.",
          413,
        );
      }
      if (response.status === 402 || response.status === 429) {
        const retryAfter = Number((body.match(/retry after (\d+)\s*s/i) ?? [])[1] ?? NaN);
        throw new AiError(
          /free_tier|free tier/i.test(body)
            ? "The provider's free-tier daily quota is exhausted."
            : /FREE_LIMIT/i.test(body)
              ? "The keyless endpoint allows one answer every 45 seconds and is cooling down."
              : "The provider is rate limiting this key.",
          response.status,
          Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
        );
      }
      throw new AiError(`The provider returned HTTP ${response.status}.`, response.status);
    }
    const data = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      model?: string;
    };
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (!text) {
      console.error(`[ai] ${endpoint.name} empty completion`, choice?.finish_reason);
      throw new AiError(`The model returned no text (finish_reason: ${choice?.finish_reason ?? "unknown"}).`, 502);
    }
    return { text, model: data.model ?? model, provider: endpoint.name, finishReason: choice?.finish_reason };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if ((error as Error)?.name === "AbortError") {
      console.error(`[ai] ${endpoint.name} timeout after`, timeoutMs, "ms");
      throw new AiError(`did not answer within ${Math.round(timeoutMs / 1000)}s.`, 408);
    }
    console.error(`[ai] ${endpoint.name} request failed`, (error as Error)?.message ?? error);
    throw new AiError("request failed (network error).", 502);
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

export interface FanoutResult {
  provider: string;
  label: string;
  answer: AiAnswer | null;
  error?: string;
}

/**
 * Ask several providers the same question at the same time, independently.
 * Each model answers on its own — no model sees another's answer — so the
 * reports can be compared rather than chained. Keyed providers are preferred;
 * the keyless endpoint fills in when there are not enough of them.
 */
export async function aiFanout(
  messages: AiMessage[],
  options?: AiOptions & { limit?: number },
): Promise<FanoutResult[]> {
  const limit = Math.max(2, options?.limit ?? config.ai.analysts);
  const order = config.ai.analystEndpoints;
  const timeoutMs = options?.timeoutMs ?? 60_000;

  const ask = async (endpoint: (typeof order)[number]): Promise<FanoutResult> => {
    try {
      const answer = await attempt(endpoint, messages, { ...options, retryOnTruncation: false }, timeoutMs);
      return { provider: endpoint.name, label: endpoint.label, answer };
    } catch (error) {
      return { provider: endpoint.name, label: endpoint.label, answer: null, error: (error as Error).message };
    }
  };

  // First wave: the best providers, in parallel. Later waves only run when a
  // provider above was dead — the point is two answers, not two attempts.
  const results: FanoutResult[] = [];
  let asked = 0;
  while (results.filter((result) => result.answer).length < limit && asked < order.length) {
    const wave = order.slice(asked, asked + Math.min(3, limit - results.filter((r) => r.answer).length + 1));
    asked += wave.length;
    results.push(...(await Promise.all(wave.map(ask))));
  }
  return results;
}

export interface ProviderProbe {
  name: string;
  label: string;
  keyless: boolean;
  ok: boolean;
  ms: number;
  model?: string;
  error?: string;
}

/**
 * Health check for the AI chain: asks every provider the same one-line question
 * and reports who answered. Used by the admin desk to tell "the key is dead"
 * apart from "the desk is out of quota" without running a whole research file.
 */
export async function probeProviders(only?: string, timeoutMs = 25_000): Promise<ProviderProbe[]> {
  const chain = config.ai.chain.filter((endpoint) => !only || endpoint.name === only);
  const probes: ProviderProbe[] = [];
  for (const endpoint of chain) {
    const startedAt = Date.now();
    try {
      const answer = await aiRequest(
        endpoint,
        [{ role: "user", content: 'Answer with exactly this JSON and nothing else: {"ok":true}' }],
        { json: true, temperature: 0, maxTokens: 40, retryOnTruncation: false },
        timeoutMs,
      );
      probes.push({
        name: endpoint.name,
        label: endpoint.label,
        keyless: endpoint.keyless,
        ok: Boolean(answer),
        ms: Date.now() - startedAt,
        model: answer?.model,
        error: answer ? undefined : "no answer",
      });
    } catch (error) {
      probes.push({
        name: endpoint.name,
        label: endpoint.label,
        keyless: endpoint.keyless,
        ok: false,
        ms: Date.now() - startedAt,
        error: (error as Error).message,
      });
    }
  }
  return probes;
}
