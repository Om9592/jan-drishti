import { NextResponse } from "next/server";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { getStore } from "@/lib/store";
import { hashIp, requireRole } from "@/lib/security/auth";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { config, isDemoMode } from "@/lib/config";
import { submissionSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const ip = clientIp(request);
    const limit = rateLimit(`submission:${ip}`, config.security.submissionRateLimit, 60 * 60 * 1000);
    if (!limit.allowed) {
      const response = jsonError(
        "Too many submissions from this connection. Please try again later, or email us directly.",
        429,
      );
      for (const [k, v] of Object.entries(rateLimitHeaders(limit))) response.headers.set(k, v);
      return response;
    }

    const payload = await request.json().catch(() => null);
    const parsed = submissionSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      });
    }

    const data = parsed.data;
    const store = getStore();
    const submission = await store.createSubmission({
      type: data.type,
      content: data.content,
      url: data.url || null,
      imageUrl: data.imageUrl || null,
      claimedSource: data.claimedSource || null,
      contactEmail: data.contactEmail || null,
      submitterName: data.submitterName || null,
      language: data.language,
      ipHash: hashIp(ip),
    });

    const response = jsonOk({
      id: submission.id,
      reference: submission.id.slice(-8).toUpperCase(),
      status: submission.status,
      demo: isDemoMode(),
      note: isDemoMode()
        ? "Preview mode: this submission is held in an in-memory queue and is not stored permanently."
        : "Submission stored. A researcher will review it.",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

export async function GET() {
  return handleRoute(async () => {
    await requireRole("researcher");
    const store = getStore();
    const submissions = await store.listSubmissions("all");
    return NextResponse.json({ ok: true, submissions });
  });
}
