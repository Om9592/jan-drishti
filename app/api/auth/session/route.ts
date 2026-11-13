import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { config, isFirebaseAdminConfigured } from "@/lib/config";
import { createSessionCookie, getViewer } from "@/lib/security/auth";
import { jsonError, jsonOk } from "@/lib/api";

const bodySchema = z.object({ idToken: z.string().min(20) });

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) {
    return jsonError(
      "Sign-in requires Firebase Admin credentials on the server (FIREBASE_PROJECT_ID + service account). This preview runs without them, so authentication is disabled rather than simulated.",
      503,
    );
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid sign-in payload.", 422);

  try {
    const sessionCookie = await createSessionCookie(parsed.data.idToken);
    const store = await cookies();
    store.set(config.auth.sessionCookieName, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 24 * 60 * 60,
    });
    const viewer = await getViewer();
    return jsonOk({ viewer });
  } catch (error) {
    console.error("[auth] session creation failed", error);
    return jsonError("Could not create a session. Please sign in again.", 401);
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(config.auth.sessionCookieName);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const viewer = await getViewer();
  return NextResponse.json({ ok: true, viewer });
}
