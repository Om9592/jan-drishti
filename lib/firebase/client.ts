"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { config } from "@/lib/config";

/**
 * Client SDK is initialised lazily and only when public Firebase config exists.
 * No secret is ever placed in NEXT_PUBLIC_* variables.
 */
export function firebaseClientReady(): boolean {
  return Boolean(config.firebase.apiKey && config.firebase.projectId);
}

function getClientApp(): FirebaseApp {
  if (!firebaseClientReady()) {
    throw new Error("Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_* variables.");
  }
  if (getApps().length > 0) return getApp();
  return initializeApp({
    apiKey: config.firebase.apiKey,
    authDomain: config.firebase.authDomain,
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
    messagingSenderId: config.firebase.messagingSenderId,
    appId: config.firebase.appId,
  });
}

export function clientAuth(): Auth {
  return getAuth(getClientApp());
}

export function clientDb(): Firestore {
  return getFirestore(getClientApp());
}

export function clientStorage(): FirebaseStorage {
  return getStorage(getClientApp());
}
