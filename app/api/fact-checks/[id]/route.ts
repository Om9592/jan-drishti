import { NextResponse } from "next/server";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { factCheckDecisionSchema } from "@/lib/validation/schemas";
import { approveAndPublish } from "@/lib/services/research-service";

export const dynamic = "force-dynamic";

/**
 * Editorial decision endpoint. Only editor/admin can reach it.
 * `save` keeps the file in review; `publish` requires a named reviewer and
 * stamps verifiedAt; `reject` removes it from the queue without publishing.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const { id } = await context.params;
    const viewer = await requireRole("editor");
    const payload = await request.json().catch(() => null);
    const parsed = factCheckDecisionSchema.safeParse({ ...(payload as object), id });
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      });
    }

    const store = getStore();
    const existing = await store.getFactCheckById(id);
    if (!existing) return jsonError("Fact-check file not found.", 404);

    if (parsed.data.action === "reject") {
      await store.saveFactCheck({ ...existing, status: "rejected", updatedAt: new Date().toISOString() });
      await store.appendAudit({
        action: "factcheck.rejected",
        actorId: viewer.uid,
        actorEmail: viewer.email ?? undefined,
        targetType: "factCheck",
        targetId: id,
        summary: "File rejected at review; no verdict published.",
      });
      return jsonOk({ status: "rejected" });
    }

    if (parsed.data.action === "save") {
      const saved = await store.saveFactCheck({
        ...existing,
        verdict: parsed.data.verdict,
        explanationEn: parsed.data.explanationEn,
        contextEn: parsed.data.contextEn,
        headlineEn: parsed.data.headlineEn,
        confidenceLevel: parsed.data.confidenceLevel,
        notesForReviewer: parsed.data.notesForReviewer ?? existing.notesForReviewer,
        status: "in_review",
        updatedAt: new Date().toISOString(),
      });
      return jsonOk({ status: saved.status });
    }

    const published = await approveAndPublish(
      id,
      {
        verdict: parsed.data.verdict,
        explanationEn: parsed.data.explanationEn,
        contextEn: parsed.data.contextEn,
        headlineEn: parsed.data.headlineEn,
        confidenceLevel: parsed.data.confidenceLevel,
        notesForReviewer: parsed.data.notesForReviewer,
      },
      {
        id: viewer.uid,
        name: viewer.name ?? viewer.email ?? "Editor",
        email: viewer.email ?? undefined,
      },
    );

    if (!published) return jsonError("Publication failed.", 500);
    const response = jsonOk({ status: published.status, slug: published.slug });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    await requireRole("researcher");
    const { id } = await context.params;
    const store = getStore();
    const fc = await store.getFactCheckById(id);
    if (!fc) return jsonError("Not found", 404);
    return jsonOk({ factCheck: fc });
  });
}
