import type { MetadataRoute } from "next";
import { getStore } from "@/lib/store";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const store = getStore();
  const base = config.siteUrl;

  const staticPaths = [
    "",
    "/latest",
    "/india",
    "/politics",
    "/economy",
    "/education",
    "/health",
    "/states",
    "/ground-reports",
    "/ask",
    "/fact-check",
    "/submit",
    "/contribute",
    "/contributors",
    "/search",
    "/about",
    "/editorial-policy",
    "/fact-checking-methodology",
    "/corrections",
    "/contact",
    "/funding",
    "/privacy",
    "/terms",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/latest" ? "hourly" : "weekly",
    priority: path === "" ? 1 : path.startsWith("/fact-check") ? 0.9 : 0.7,
  }));

  try {
    const [articles, factChecks] = await Promise.all([
      store.listArticles({ status: "published", limit: 1000 }),
      store.listFactChecks({ status: "published", limit: 500 }),
    ]);

    return [
      ...staticEntries,
      ...articles.items.map((article) => ({
        url: `${base}/article/${article.slug}`,
        lastModified: new Date(article.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...factChecks.items.map((fc) => ({
        url: `${base}/fact-check/${fc.slug}`,
        lastModified: new Date(fc.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
