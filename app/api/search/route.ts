import { handleRoute, jsonError } from "@/lib/api";
import { getStore } from "@/lib/store";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Lightweight JSON search used by the header search box (full results live at /search). */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const ip = clientIp(request);
    const limit = rateLimit(`search:${ip}`, 60, 60 * 1000);
    if (!limit.allowed) return jsonError("Slow down a moment.", 429);

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return { articles: [], factChecks: [] };

    const store = getStore();
    const [articles, factChecks] = await Promise.all([
      store.listArticles({ q, status: "published", limit: 5 }),
      store.listFactChecks({ q, status: "published", limit: 3 }),
    ]);

    return {
      articles: articles.items.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        categorySlug: a.categorySlug,
        publishedAt: a.publishedAt,
      })),
      factChecks: factChecks.items.map((f) => ({
        id: f.id,
        headline: f.headlineEn,
        slug: f.slug,
        verdict: f.verdict,
      })),
    };
  });
}
