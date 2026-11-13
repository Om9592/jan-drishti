import { NextResponse } from "next/server";
import { ingestAll } from "@/lib/ingestion/rss";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled ingestion (Vercel Cron: see vercel.json).
 * Protected by CRON_SECRET so it cannot be triggered by the public.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured; ingestion endpoint is disabled." },
      { status: 503 },
    );
  }
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results = await ingestAll(true);
  return NextResponse.json({ ok: true, results });
}
