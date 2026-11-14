/**
 * Environment configuration.
 *
 * Every integration is optional so the application can boot, render and be
 * reviewed without credentials — but nothing is ever faked. When a provider is
 * missing, the UI says so explicitly (see `capabilities()` below).
 */

function env(key: string): string | undefined {
  const value = process.env[key];
  if (!value || value.trim() === "" || value.startsWith("your-")) return undefined;
  return value;
}

/**
 * One key is enough. Every provider below speaks the OpenAI-compatible
 * /chat/completions shape, so `AI_PROVIDER=gemini` plus `AI_API_KEY=…` is all
 * the desk needs; explicit AI_BASE_URL / AI_MODEL still win.
 */
const AI_PRESETS = {
  openai: { name: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  gemini: {
    name: "gemini",
    // Google retires Gemini model ids regularly (2.0/2.5-flash now 404 for new
    // keys), so this is only a starting point: set AI_MODEL to whatever
    // `models.list` reports for your key, and a 404 is surfaced in the UI
    // rather than silently producing an empty answer.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash",
  },
  // Free tiers, in the order they are worth reaching for: Groq is fast and
  // generous, OpenRouter's ":free" models need no card, Cerebras is small but
  // quick. Any of these keys present in the environment joins the chain.
  groq: { name: "groq", baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  openrouter: { name: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free" },
  cerebras: { name: "cerebras", baseUrl: "https://api.cerebras.ai/v1", model: "llama3.1-8b" },
  mistral: { name: "mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  deepseek: { name: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  /**
   * No signup, no key, no card: the community Pollinations endpoint speaks the
   * same OpenAI shape and serves an open-weights reasoning model. It is rate
   * limited to roughly one answer per 45 s per IP, so it is the LAST resort and
   * it waits its turn — used when every keyed provider is exhausted or absent.
   */
  pollinations: { name: "pollinations", baseUrl: "https://text.pollinations.ai/openai", model: "openai" },
} as const;

export interface AiEndpoint {
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  /** True for the keyless community endpoint. */
  keyless: boolean;
}

type PresetName = keyof typeof AI_PRESETS;
const AI_PRESET_NAME = (env("AI_PROVIDER") ?? "gemini").toLowerCase();
const AI_PRESET: (typeof AI_PRESETS)[PresetName] =
  AI_PRESETS[AI_PRESET_NAME as PresetName] ?? AI_PRESETS.openai;

/**
 * Providers are tried in order until one answers. A desk with a free key should
 * never be dead because that one key hit its daily cap, so the chain ends at a
 * keyless endpoint whenever `AI_KEYLESS_FALLBACK` is not set to 0.
 */
function buildAiChain(): AiEndpoint[] {
  const chain: AiEndpoint[] = [];
  const primaryKey = env("AI_API_KEY") ?? env("OPENAI_API_KEY");
  if (primaryKey && AI_PRESET.name !== "pollinations") {
    chain.push({
      name: AI_PRESET.name,
      label: `${AI_PRESET.name} (${env("AI_MODEL") ?? AI_PRESET.model})`,
      baseUrl: (env("AI_BASE_URL") ?? AI_PRESET.baseUrl).replace(/\/$/, ""),
      apiKey: primaryKey,
      model: env("AI_MODEL") ?? AI_PRESET.model,
      keyless: false,
    });
  }
  // Other free keys, if the desk happens to have them.
  const extras: { preset: PresetName; key?: string; modelEnv: string }[] = [
    { preset: "groq", key: env("GROQ_API_KEY"), modelEnv: "GROQ_MODEL" },
    { preset: "openrouter", key: env("OPENROUTER_API_KEY"), modelEnv: "OPENROUTER_MODEL" },
    { preset: "cerebras", key: env("CEREBRAS_API_KEY"), modelEnv: "CEREBRAS_MODEL" },
    { preset: "mistral", key: env("MISTRAL_API_KEY"), modelEnv: "MISTRAL_MODEL" },
  ];
  for (const extra of extras) {
    if (!extra.key || chain.some((endpoint) => endpoint.name === extra.preset)) continue;
    const preset = AI_PRESETS[extra.preset];
    chain.push({
      name: preset.name,
      label: `${preset.name} (${env(extra.modelEnv) ?? preset.model})`,
      baseUrl: preset.baseUrl.replace(/\/$/, ""),
      apiKey: extra.key,
      model: env(extra.modelEnv) ?? preset.model,
      keyless: false,
    });
  }
  if (env("AI_KEYLESS_FALLBACK") !== "0") {
    const preset = AI_PRESETS.pollinations;
    chain.push({
      name: preset.name,
      label: "pollinations (keyless, gpt-oss-20b)",
      baseUrl: preset.baseUrl,
      apiKey: null,
      model: env("AI_KEYLESS_MODEL") ?? preset.model,
      keyless: true,
    });
  }
  return chain;
}

const AI_CHAIN = buildAiChain();
const AI_PRIMARY = AI_CHAIN[0];

/** The key that belongs to a preset, whichever env var it lives in. */
function keyForPreset(name: PresetName): string | undefined {
  if (name === AI_PRESET.name) return env("AI_API_KEY") ?? env("OPENAI_API_KEY");
  const custom = env(`${name.toUpperCase()}_API_KEY`);
  if (custom) return custom;
  return name === "openai" ? env("OPENAI_API_KEY") : undefined;
}

/**
 * The cross-check bench. Every keyed provider is one voice, and a provider that
 * serves several model families gets a second voice — one vendor's small model
 * and its large one disagree often enough to be worth asking separately.
 * `AI_ANALYST_MODELS` spells them out: "groq:qwen/qwen3.8-27b,groq:openai/gpt-oss-20b".
 */
function buildAnalystEndpoints(chain: AiEndpoint[]): AiEndpoint[] {
  const endpoints = chain.filter((endpoint) => !endpoint.keyless).map((endpoint) => ({ ...endpoint }));
  const specs = (env("AI_ANALYST_MODELS") ?? "groq:openai/gpt-oss-20b")
    .split(",")
    .map((spec) => spec.trim())
    .filter(Boolean);
  for (const spec of specs) {
    const separator = spec.indexOf(":");
    if (separator < 1) continue;
    const provider = spec.slice(0, separator).trim() as PresetName;
    const model = spec.slice(separator + 1).trim();
    const preset = AI_PRESETS[provider];
    const apiKey = keyForPreset(provider);
    if (!preset || !model || !apiKey) continue;
    if (endpoints.some((endpoint) => endpoint.name === provider && endpoint.model === model)) continue;
    endpoints.push({
      name: provider,
      label: `${provider} (${model})`,
      baseUrl: preset.baseUrl.replace(/\/$/, ""),
      apiKey,
      model,
      keyless: false,
    });
  }
  // The keyless endpoint is a real (if slow) voice of its own.
  return [...endpoints, ...chain.filter((endpoint) => endpoint.keyless)];
}

const firebaseProjectId = env("FIREBASE_PROJECT_ID") ?? env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const firebaseClientKey =
  env("NEXT_PUBLIC_FIREBASE_API_KEY") ?? env("FIREBASE_API_KEY");
const firebaseAdminCreds = Boolean(
  env("FIREBASE_SERVICE_ACCOUNT_JSON") ||
    (env("FIREBASE_CLIENT_EMAIL") && env("FIREBASE_PRIVATE_KEY")),
);

export const config = {
  siteUrl: (env("NEXT_PUBLIC_SITE_URL") ?? "https://jan-drishti.vercel.app").replace(/\/$/, ""),
  siteName: "Jan Drishti",
  firebase: {
    projectId: firebaseProjectId,
    apiKey: firebaseClientKey,
    authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") ?? (firebaseProjectId ? `${firebaseProjectId}.firebaseapp.com` : undefined),
    storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") ?? (firebaseProjectId ? `${firebaseProjectId}.appspot.com` : undefined),
    messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
    clientEmail: env("FIREBASE_CLIENT_EMAIL"),
    privateKey: env("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
    serviceAccountJson: env("FIREBASE_SERVICE_ACCOUNT_JSON"),
  },
  ai: {
    /** Providers in failover order; the first entry is the primary. */
    chain: AI_CHAIN,
    /** Everyone who gets asked to judge the evidence, independently. */
    analystEndpoints: buildAnalystEndpoints(AI_CHAIN),
    apiKey: AI_PRIMARY?.apiKey ?? undefined,
    baseUrl: AI_PRIMARY?.baseUrl ?? "",
    model: AI_PRIMARY?.model ?? "",
    provider: AI_PRIMARY?.name ?? "none",
    /** Optional secondary model used only for translation drafting. */
    translationModel: env("AI_TRANSLATION_MODEL"),
    /**
     * Reasoning-capable models can spend minutes "thinking" before emitting the
     * first token. That is fine for prose and fatal for a JSON pipeline that has
     * a request deadline, so structured calls ask for the smallest effort.
     */
    /**
     * "low" is the only scale every provider agrees on: Groq's open-weights
     * servers reject "minimal" outright, and a rejected parameter costs a whole
     * request against a per-minute token budget.
     */
    reasoningEffort: env("AI_REASONING_EFFORT") ?? "low",
    /**
     * A research run needs one model call to write the verdict. Spending a
     * second call on claim extraction is a luxury: keyless retrieval already
     * works from deterministic queries, and free tiers allow 20 calls a day.
     */
    aiExtraction: env("RESEARCH_AI_EXTRACTION") === "1",
    /**
     * Verification is a cross-examination, not a single opinion: every claim is
     * read independently by this many providers, then re-checked once against
     * their answers. Two is the floor — one model agreeing with itself is not
     * verification.
     */
    analysts: Math.max(2, Number(env("AI_ANALYSTS") ?? 2)),
    /** Provider that re-checks the analysts. Empty = best in the chain. */
    adjudicator: env("AI_ADJUDICATOR") ?? "",
    /**
     * Model for that re-check. Pin it to a model no analyst used and the check
     * is a third opinion rather than the same voice twice.
     */
    adjudicatorModel: env("AI_ADJUDICATOR_MODEL") ?? "",
  },
  search: {
    tavilyKey: env("TAVILY_API_KEY"),
    braveKey: env("BRAVE_SEARCH_API_KEY"),
    serperKey: env("SERPER_API_KEY"),
  },
  ocr: {
    provider: env("OCR_PROVIDER") ?? (env("AI_API_KEY") || env("OPENAI_API_KEY") ? "ai-vision" : undefined),
  },
  newsApi: {
    key: env("NEWS_API_KEY"),
    provider: env("NEWS_API_PROVIDER") ?? "newsapi",
  },
  auth: {
    sessionCookieName: "__session",
  },
  security: {
    submissionRateLimit: Number(env("SUBMISSION_RATE_LIMIT") ?? 5),
    researchRateLimit: Number(env("RESEARCH_RATE_LIMIT") ?? 10),
    /** Public self-serve AI checks per connection per hour. */
    publicCheckRateLimit: Number(env("PUBLIC_CHECK_RATE_LIMIT") ?? 6),
    /**
     * How long the chat checker may spend before it answers with what it has.
     * Free tiers rate limit hard and the keyless model is slow, so the budget
     * has to be long enough for a second or third provider to answer — the
     * route is allowed 300 s on this plan, and the reply states what was
     * skipped rather than pretending it was checked.
     */
    chatBudgetMs: Number(env("CHAT_BUDGET_MS") ?? 110_000),
  },
} as const;

export function isFirebaseConfigured(): boolean {
  return Boolean(config.firebase.projectId && config.firebase.apiKey);
}

/** Server-side admin access (Firestore writes, Auth verification). */
export function isFirebaseAdminConfigured(): boolean {
  return Boolean(config.firebase.projectId && firebaseAdminCreds);
}

export function isAiConfigured(): boolean {
  return config.ai.chain.length > 0;
}

export function isSearchConfigured(): boolean {
  return Boolean(config.search.tavilyKey || config.search.braveKey || config.search.serperKey);
}

/**
 * True when no database is configured: the app runs on the labelled sample
 * store. Never presented to readers as live reporting.
 */
export function isDemoMode(): boolean {
  return !isFirebaseAdminConfigured();
}

export function capabilities() {
  return {
    database: isFirebaseAdminConfigured() ? "firestore" : "sample",
    firebaseClient: isFirebaseConfigured(),
    ai: isAiConfigured(),
    search: isSearchConfigured(),
    /** Keyless evidence retrieval (Google News RSS, Bing News RSS, wire, Wikipedia). */
    evidence: true,
    ocr: Boolean(config.ocr.provider),
    newsApi: Boolean(config.newsApi.key),
    demo: isDemoMode(),
  } as const;
}
