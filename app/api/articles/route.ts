import { NextResponse } from "next/server";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { articleSchema } from "@/lib/validation/schemas";
import { sanitizeEditorialHtml, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    // Contributors may draft and submit; editors and admins may publish.
    const viewer = await requireRole("contributor");
    if (viewer.role === "researcher") {
      return jsonError("Researchers file fact-check evidence; they do not write articles.", 403);
    }
    const isContributor = viewer.role === "contributor";
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

    if (isContributor) {
      // A contributor can only ever save their own work, and only as a draft or
      // a submission for review. Publishing requires an editor.
      if (data.id) {
        const existing = await store.getArticleById(data.id);
        if (!existing) return jsonError("Story not found.", 404);
        if (existing.authorId !== viewer.uid) {
          return jsonError("You can only edit your own stories.", 403);
        }
      }
      data.status = data.status === "draft" ? "draft" : "review";
      data.authorId = viewer.uid;
      data.authorName = viewer.name ?? viewer.email ?? "Freelance contributor";
      data.featured = false;
      data.underreported = false;
      data.groundReport = false;
    }

    // Editors may file on someone else's behalf; if no byline id is supplied the
    // account doing the filing is the author.
    if (!data.authorId) data.authorId = viewer.uid;

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
