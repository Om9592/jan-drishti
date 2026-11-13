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
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
  },
  groq: { name: "groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openrouter: { name: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "google/gemini-2.0-flash-001" },
  deepseek: { name: "deepseek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
} as const;

const AI_PRESET =
  AI_PRESETS[(env("AI_PROVIDER") ?? "openai").toLowerCase() as keyof typeof AI_PRESETS] ?? AI_PRESETS.openai;

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
    apiKey: env("AI_API_KEY") ?? env("OPENAI_API_KEY"),
    baseUrl: (env("AI_BASE_URL") ?? AI_PRESET.baseUrl).replace(/\/$/, ""),
    model: env("AI_MODEL") ?? AI_PRESET.model,
    provider: AI_PRESET.name,
    /** Optional secondary model used only for translation drafting. */
    translationModel: env("AI_TRANSLATION_MODEL"),
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
  return Boolean(config.ai.apiKey);
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
