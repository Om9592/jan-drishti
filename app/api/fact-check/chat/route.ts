import { z } from "zod";
import { config, isAiConfigured } from "@/lib/config";
import { getViewer, hashIp } from "@/lib/security/auth";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { runChatTurn } from "@/lib/services/public-chat";
import { languageSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z
  .object({
    threadId: z.string().trim().min(6).max(80),
    language: languageSchema.default("en"),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(1500),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Streaming checker for the chat page.
 *
 * Server-sent events rather than a single response, because the honest shape of
 * this work is: search (seconds), cross-check (seconds), then write. The reader
 * sees each stage and then the answer as it is typed, instead of one long wait
 * and a wall of text.
 */
export async function POST(request: Request) {
  if (!isAiConfigured()) {
    return new Response(JSON.stringify({ ok: false, error: "The AI checker is not configured on this deployment." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = clientIp(request);
  // Signed-in readers get a larger allowance than anonymous ones: the answer
  // costs three model calls and a dozen retrievals.
  const viewer = await getViewer().catch(() => null);
  const limit = rateLimit(
    `chat:${viewer?.uid ?? ip}`,
    viewer ? config.security.publicCheckRateLimit * 3 : config.security.publicCheckRateLimit,
    60 * 60 * 1000,
  );
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "You have asked several questions this hour. Please try again shortly.",
        resetAt: limit.resetAt,
      }),
      { status: 429, headers: { "Content-Type": "application/json", ...rateLimitHeaders(limit) } },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return new Response(JSON.stringify({ ok: false, error: "Please write a question before sending." }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { threadId, language, messages } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          closed = true;
        }
      };

      // A proxy will drop a silent connection; tell the reader we are still working.
      send("open", { threadId });
      const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 8000);

      try {
        const result = await runChatTurn({
          messages,
          language,
          ipHash: hashIp(ip),
          threadId,
          onStatus: (stage) => send("status", stage),
          onDelta: (chunk) => send("delta", { text: chunk }),
        });
        send("done", result);
      } catch (error) {
        console.error("[chat] turn failed", error);
        send("error", {
          error:
            error instanceof Error && /evidence/i.test(error.message)
              ? "The search returned nothing usable for this question. Try naming the place, the date and the number."
              : "The check could not be completed. Please try again.",
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client going away.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
