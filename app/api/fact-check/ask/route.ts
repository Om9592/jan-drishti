import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { hashIp } from "@/lib/security/auth";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { config, isAiConfigured } from "@/lib/config";
import { publicAskSchema } from "@/lib/validation/schemas";
import { answerPublicCheck } from "@/lib/services/public-checks";

export const dynamic = "force-dynamic";
/** Evidence retrieval plus a cross-checked model pass: not a default-budget job. */
export const maxDuration = 300;

/**
 * Public self-serve fact-check.
 *
 * Anyone can ask; the machine answers directly, using the same evidence-first
 * pipeline the desk uses. The answer is returned to the reader and recorded for
 * the editorial panel — it is never published into the fact-check archive and it
 * is never presented as an editor's verdict.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    if (!isAiConfigured()) {
      return jsonError("The AI check is not configured on this deployment.", 503);
    }

    const ip = clientIp(request);
    const limit = rateLimit(`ask:${ip}`, config.security.publicCheckRateLimit, 60 * 60 * 1000);
    if (!limit.allowed) {
      const response = jsonError(
        "You have asked for several checks in the last hour. Please try again later — or send the claim to the editorial desk.",
        429,
      );
      for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
      return response;
    }

    const payload = await request.json().catch(() => null);
    const parsed = publicAskSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError("Please check the claim you entered.", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join(".") || "claim", issue.message])),
      });
    }

    const answer = await answerPublicCheck({
      claim: parsed.data.claim,
      language: parsed.data.language,
      ipHash: hashIp(ip),
    });

    const response = jsonOk({
      answer,
      note: "Machine answer. Sources are listed so you can check them yourself; the editorial verdict is issued separately after human review.",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  });
}

/** Public capability probe so the form can hide itself when the AI is off. */
export async function GET() {
  return handleRoute(async () =>
    jsonOk({
      ai: isAiConfigured(),
      model: config.ai.model,
      providers: config.ai.chain.map((endpoint) => endpoint.name),
      rateLimitPerHour: config.security.publicCheckRateLimit,
    }),
  );
}
