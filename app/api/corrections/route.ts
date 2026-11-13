import { NextResponse } from "next/server";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { correctionSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const viewer = await requireRole("editor");
    const parsed = correctionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      });
    }
    if (!parsed.data.articleId && !parsed.data.factCheckId) {
      return jsonError("A correction must reference an article or a fact check.", 422);
    }

    const store = getStore();
    const correction = await store.addCorrection(
      {
        id: "",
        articleId: parsed.data.articleId,
        factCheckId: parsed.data.factCheckId,
        date: new Date().toISOString(),
        summaryEn: parsed.data.summaryEn,
        summaryHi: parsed.data.summaryHi,
        detailEn: parsed.data.detailEn,
        detailHi: parsed.data.detailHi,
        issuedBy: viewer.name ?? "Jan Drishti Editorial Desk",
        severity: parsed.data.severity,
      },
      { id: viewer.uid, email: viewer.email ?? undefined },
    );

    const response = jsonOk({ correction });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

export async function GET() {
  return handleRoute(async () => {
    const store = getStore();
    return NextResponse.json({ ok: true, corrections: await store.listCorrections() });
  });
}
