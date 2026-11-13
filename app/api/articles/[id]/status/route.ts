import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["draft", "review", "scheduled", "published", "archived"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const viewer = await requireRole("editor");
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Unknown status.", 422);

    const store = getStore();
    const article = await store.setArticleStatus(id, parsed.data.status, {
      id: viewer.uid,
      email: viewer.email ?? undefined,
    });
    if (!article) return jsonError("Article not found.", 404);
    const response = jsonOk({ status: article.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}
