import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { getStore } from "@/lib/store";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { newsletterSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const ip = clientIp(request);
    const limit = rateLimit(`newsletter:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) return jsonError("Too many attempts. Please try again later.", 429);

    const parsed = newsletterSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Enter a valid email address.", 422, {
        fields: { email: "Enter a valid email address." },
      });
    }

    const store = getStore();
    const result = await store.addNewsletterSubscriber(parsed.data.email);
    return jsonOk(result);
  });
}
