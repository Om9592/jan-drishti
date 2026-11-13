import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { adminAuth, adminDb, COLLECTIONS } from "@/lib/firebase/admin";
import { config, isDemoMode } from "@/lib/config";
import type { EditorialUser, Role, Viewer } from "@/lib/types";

export type { Viewer };

const ROLE_RANK: Record<Role, number> = { user: 1, contributor: 2, researcher: 3, editor: 4, admin: 5 };

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Better Auth-style demo viewer: clearly flagged, never authenticated. */
const DEMO_VIEWER: Viewer = {
  uid: "demo-editor",
  email: null,
  name: "Demo session",
  role: "admin",
  demo: true,
  authenticated: false,
};

async function roleForUser(uid: string, email?: string | null): Promise<Role> {
  const db = adminDb();
  if (!db) return "user";
  try {
    const doc = await db.collection(COLLECTIONS.users).doc(uid).get();
    if (doc.exists) {
      const data = doc.data() as EditorialUser;
      if (data.role) return data.role;
    }
    if (email) {
      const snap = await db
        .collection(COLLECTIONS.users)
        .where("email", "==", email.toLowerCase())
        .limit(1)
        .get();
      const found = snap.docs[0];
      if (found) {
        const data = found.data() as EditorialUser;
        await db.collection(COLLECTIONS.users).doc(uid).set(
          { email: email.toLowerCase(), name: data.name ?? "", role: data.role ?? "user", status: "active" },
          { merge: true },
        );
        return data.role ?? "user";
      }
    }
  } catch {
    // Fall through to least privilege.
  }
  return "user";
}

/**
 * Resolve the current viewer from the httpOnly session cookie.
 * Roles are always read server-side — never from the client.
 */
export async function getViewer(): Promise<Viewer | null> {
  const auth = adminAuth();
  const cookieStore = await cookies();
  const session = cookieStore.get(config.auth.sessionCookieName)?.value;

  if (!auth) {
    return isDemoMode() ? DEMO_VIEWER : null;
  }

  if (!session) {
    return null;
  }

  try {
    const decoded = await auth.verifySessionCookie(session, true);
    const role = await roleForUser(decoded.uid, decoded.email ?? null);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? decoded.email ?? null,
      role,
      demo: false,
      authenticated: true,
    };
  } catch {
    return null;
  }
}

export async function requireRole(minimum: Role): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    throw new AuthError("Sign in to continue.", 401);
  }
  if (!hasAtLeast(viewer.role, minimum)) {
    throw new AuthError("You do not have permission for this action.", 403);
  }
  return viewer;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

/** Creates a 5-day session cookie from a freshly minted Firebase ID token. */
export async function createSessionCookie(idToken: string): Promise<string> {
  const auth = adminAuth();
  if (!auth) throw new AuthError("Authentication is not configured on the server.", 503);
  const decoded = await auth.verifyIdToken(idToken, true);
  const expiresIn = 5 * 24 * 60 * 60 * 1000;
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

  const db = adminDb();
  if (db) {
    const role = await roleForUser(decoded.uid, decoded.email ?? null);
    await db.collection(COLLECTIONS.users).doc(decoded.uid).set(
      {
        email: (decoded.email ?? "").toLowerCase(),
        name: (decoded.name as string | undefined) ?? "",
        role,
        status: "active",
        lastSeenAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }
  return sessionCookie;
}

export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${process.env.IP_HASH_SALT ?? "jan-drishti"}`)
    .digest("hex")
    .slice(0, 24);
}
