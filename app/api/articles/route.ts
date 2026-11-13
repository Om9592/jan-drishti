import { NextResponse } from "next/server";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { articleSchema } from "@/lib/validation/schemas";
import { sanitizeEditorialHtml, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const viewer = await requireRole("editor");
    const payload = await request.json().catch(() => null);
    const parsed = articleSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      });
    }

    const data = parsed.data;
    const store = getStore();
    const article = await store.saveArticle(
      {
        id: data.id,
        title: data.title,
        subtitle: data.subtitle,
        summary: data.summary,
        content: sanitizeEditorialHtml(data.content),
        language: data.language,
        categoryId: data.categoryId,
        authorId: data.authorId,
        authorName: data.authorName,
        imageUrl: data.imageUrl || null,
        imageCaption: data.imageCaption,
        imageCredit: data.imageCredit,
        status: data.status,
        kind: data.kind,
        state: data.state || null,
        tags: data.tags,
        featured: data.featured,
        underreported: data.underreported,
        groundReport: data.groundReport,
        publishedAt: data.publishedAt || null,
        sources: data.sources,
        seoDescription: truncate(data.summary, 155),
      },
      { id: viewer.uid, email: viewer.email ?? undefined },
    );

    return jsonOk({ article: { id: article.id, slug: article.slug, status: article.status } });
  });
}

export async function GET(_request: Request) {
  return handleRoute(async () => {
    await requireRole("researcher");
    const store = getStore();
    const result = await store.listArticles({ status: "all", limit: 100, sort: "latest" });
    return NextResponse.json({ ok: true, articles: result.items, total: result.total });
  });
}
