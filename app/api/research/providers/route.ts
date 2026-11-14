import { NextResponse } from "next/server";
import { handleRoute, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/security/auth";
import { probeProviders } from "@/lib/research/providers";
import { isAiConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * AI provider health check for the desk. An editor asks "will the next research
 * run actually get a verdict?" and this answers it — provider by provider, with
 * latency and the exact failure reason. Read-only: it never writes a fact check.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireRole("researcher");
    if (!isAiConfigured()) {
      return NextResponse.json({ ok: true, ai: false, providers: [], probes: [] });
    }
    const only = new URL(request.url).searchParams.get("only") ?? undefined;
    const probes = await probeProviders(only ?? undefined);
    return jsonOk({ ai: true, providers: probes.filter((probe) => probe.ok).map((probe) => probe.name), probes });
  });
}
