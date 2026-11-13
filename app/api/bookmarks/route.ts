import { handleRoute, jsonError } from "@/lib/api";
import { getViewer } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { bookmarkSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const viewer = await getViewer();
    if (!viewer || !viewer.authenticated) {
      return jsonError("Sign in to save stories to your account.", 401);
    }
    const parsed = bookmarkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid article.", 422);

    const store = getStore();
    const saved = await store.toggleBookmark(viewer.uid, parsed.data.articleId);
    return { saved };
  });
}

export async function GET() {
  return handleRoute(async () => {
    const viewer = await getViewer();
    if (!viewer || !viewer.authenticated) return jsonError("Sign in to view saved stories.", 401);
    const store = getStore();
    const bookmarks = await store.listBookmarks(viewer.uid);
    return { bookmarks };
  });
}
