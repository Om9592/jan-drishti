/**
 * Browser-side Firebase configuration.
 *
 * IMPORTANT: Next.js only inlines environment variables that appear as *literal*
 * member expressions (`process.env.NEXT_PUBLIC_X`) in the bundle. Reading them
 * through a helper such as `process.env[key]` (which `lib/config.ts` does for the
 * server) leaves them undefined in the browser, so the client SDK silently looks
 * unconfigured while everything on the server keeps working.
 *
 * These references must stay literal.
 */
const clientFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export type ClientFirebaseConfig = typeof clientFirebaseConfig;

export function clientFirebase(): ClientFirebaseConfig {
  return clientFirebaseConfig;
}

/** True only when the values actually reached the browser bundle. */
export function isClientFirebaseConfigured(): boolean {
  return Boolean(clientFirebaseConfig.apiKey && clientFirebaseConfig.projectId);
}
