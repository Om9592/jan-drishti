import { NextResponse } from "next/server";
import { z } from "zod";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["received", "triaged", "researching", "published", "rejected"]).optional(),
  triageNote: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const viewer = await requireRole("researcher");
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid update.", 422);

    const store = getStore();
    const submission = await store.updateSubmission(id, parsed.data, {
      id: viewer.uid,
      email: viewer.email ?? undefined,
    });
    if (!submission) return jsonError("Submission not found.", 404);
    const response = jsonOk({ submission });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}
