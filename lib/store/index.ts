import "server-only";
import { isFirebaseAdminConfigured } from "@/lib/config";
import { DemoStore } from "@/lib/store/demo";
import { FirestoreStore } from "@/lib/store/firestore";
import type { DataStore } from "@/lib/store/types";

declare global {
  // eslint-disable-next-line no-var
  var __jdStore: DataStore | undefined;
}

/**
 * Single entry point for all data access. Server components and route
 * handlers call `getStore()`; the adapter is chosen once per process.
 */
export function getStore(): DataStore {
  if (globalThis.__jdStore) return globalThis.__jdStore;
  globalThis.__jdStore = isFirebaseAdminConfigured() ? new FirestoreStore() : new DemoStore();
  return globalThis.__jdStore;
}

export type { DataStore } from "@/lib/store/types";
export * from "@/lib/store/types";
