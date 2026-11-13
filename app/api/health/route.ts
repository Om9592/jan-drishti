import { NextResponse } from "next/server";
import { capabilities } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Honest integration status, used by the footer/README parity check. */
export async function GET() {
  const store = getStore();
  const stats = await store.getStats();
  return NextResponse.json({
    ok: true,
    service: "jan-drishti",
    backend: store.backend,
    capabilities: capabilities(),
    stats,
    timestamp: new Date().toISOString(),
  });
}
