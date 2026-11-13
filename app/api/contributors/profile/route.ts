import { z } from "zod";
import { handleRoute, jsonError, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { slugify } from "@/lib/utils";
import { adminAuth } from "@/lib/firebase/admin";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Tell us the name you publish under.").max(80),
  beats: z.string().trim().max(160).optional().or(z.literal("")),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(1200).optional().or(z.literal("")),
  avatarUrl: z.string().trim().url("Enter a full image URL.").max(600).optional().or(z.literal("")),
});

/** A contributor edits their own public profile. Nobody else's. */
export async function PATCH(request: Request) {
  return handleRoute(async () => {
    const viewer = await requireRole("contributor");
    if (viewer.role !== "contributor" && viewer.role !== "admin") {
      return jsonError("Only freelance contributors have a public profile to edit.", 403);
    }
    const parsed = profileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return jsonError("Please check the highlighted fields.", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join(".") || "form", i.message])),
      });
    }

    const store = getStore();
    const users = await store.listUsers();
    const me = users.find((user) => user.id === viewer.uid);
    const slug = me?.slug || `${slugify(parsed.data.name) || "contributor"}-${viewer.uid.slice(-4).toLowerCase()}`;

    const updated = await store.updateContributorProfile(viewer.uid, {
      name: parsed.data.name,
      slug,
      beats: parsed.data.beats || "",
      location: parsed.data.location || "",
      bio: parsed.data.bio || "",
      avatarUrl: parsed.data.avatarUrl || "",
    });
    if (!updated) return jsonError("Profile could not be saved.", 500);

    // Keep the auth display name in step with the public byline.
    const auth = adminAuth();
    if (config.firebase.apiKey && auth) {
      await auth.updateUser(viewer.uid, { displayName: parsed.data.name }).catch(() => undefined);
    }

    return jsonOk({ profile: { slug, name: updated.name, beats: updated.beats ?? "", location: updated.location ?? "" } });
  });
}
