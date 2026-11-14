import { NextResponse } from "next/server";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { config } from "@/lib/config";
import { researchRequestSchema } from "@/lib/validation/schemas";
import { createResearchDraft } from "@/lib/services/research-service";
import { researchCapabilities } from "@/lib/research/engine";

export const dynamic = "force-dynamic";
/**
 * The research pipeline talks to a reasoning model, then to four keyless news
 * indexes, then to the model again. That does not fit in the default budget.
 */
export const maxDuration = 300;

/**
 * Runs the AI-assisted research pipeline for a claim and creates a reviewable
 * draft. Editorial-only: the public submits claims, humans run research.
 * The output can never be published from this endpoint.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const viewer = await requireRole("researcher");
    const ip = clientIp(request);
    const limit = rateLimit(`research:${viewer.uid}:${ip}`, config.security.researchRateLimit, 60 * 60 * 1000);
    if (!limit.allowed) return jsonError("Research rate limit reached for this hour.", 429);

    const payload = await request.json().catch(() => null);
    const parsed = researchRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      });
    }

    const { factCheck, report, submission } = await createResearchDraft({
      claimText: parsed.data.claimText,
      language: parsed.data.language,
      url: parsed.data.url || null,
      submissionId: parsed.data.submissionId ?? null,
      actor: { id: viewer.uid, email: viewer.email ?? undefined, name: viewer.name ?? undefined },
    });

    const response = jsonOk({
      factCheckId: factCheck.id,
      report,
      capabilities: researchCapabilities(),
      submission,
      notice:
        "Preliminary research only. Review every evidence item and issue the verdict yourself — the machine recommendation is not publishable.",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

export async function GET() {
  return handleRoute(async () => {
    await requireRole("researcher");
    return jsonOk({ capabilities: researchCapabilities() });
  });
}
