import { NextResponse } from "next/server";
import { handleRoute } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { ingestSource } from "@/lib/ingestion/rss";
import type { FeedSource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Toggle a feed or run it on demand from the editorial desk. */
export async function PATCH(request: Request) {
  return handleRoute(async () => {
    await requireRole("editor");
    const body = (await request.json().catch(() => null)) as
      | { id?: string; enabled?: boolean; run?: boolean }
      | null;
    if (!body?.id) return NextResponse.json({ ok: false, error: "Source id required." }, { status: 422 });

    const store = getStore();
    const sources = await store.listSources();
    const source = sources.find((s) => s.id === body.id);
    if (!source) return NextResponse.json({ ok: false, error: "Source not found." }, { status: 404 });

    const updated: FeedSource = { ...source, enabled: body.enabled ?? source.enabled };
    await store.saveSource(updated);

    if (body.run) {
      const result = await ingestSource(updated);
      return { source: updated, result };
    }
    return { source: updated };
  });
}
