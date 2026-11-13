import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { config, isFirebaseAdminConfigured } from "@/lib/config";

let cachedApp: App | null = null;

function buildCredential() {
  if (config.firebase.serviceAccountJson) {
    try {
      const parsed = JSON.parse(config.firebase.serviceAccountJson) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      return cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      });
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full service-account key file contents.",
      );
    }
  }
  if (config.firebase.clientEmail && config.firebase.privateKey) {
    return cert({
      projectId: config.firebase.projectId!,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    });
  }
  return null;
}

export function getFirebaseAdminApp(): App | null {
  if (!isFirebaseAdminConfigured()) return null;
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0]!;
    return cachedApp;
  }
  const credential = buildCredential();
  if (!credential) return null;
  cachedApp = initializeApp({
    credential,
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
  });
  return cachedApp;
}

export function adminDb(): Firestore | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

export function adminAuth(): Auth | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getAuth(app);
}

export function adminStorage() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getStorage(app);
}

export const COLLECTIONS = {
  users: "users",
  articles: "articles",
  categories: "categories",
  sources: "sources",
  claims: "claims",
  evidence: "evidence",
  factChecks: "factChecks",
  submissions: "submissions",
  corrections: "corrections",
  auditLogs: "auditLogs",
  translations: "translations",
  bookmarks: "bookmarks",
  newsletter: "newsletter",
} as const;
