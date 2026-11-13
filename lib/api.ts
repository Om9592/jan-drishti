import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/security/auth";
import { fieldErrors } from "@/lib/validation/schemas";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...(data as object) }, { status: 200, ...init });
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleRoute<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const result = await fn();
    if (result instanceof NextResponse) return result;
    return jsonOk(result as object);
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }
    if (error instanceof z.ZodError) {
      return jsonError("Please check the highlighted fields.", 422, { fields: fieldErrors(error) });
    }
    console.error("[api] unhandled error", error);
    return jsonError("Something went wrong on our side. Please try again.", 500);
  }
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
