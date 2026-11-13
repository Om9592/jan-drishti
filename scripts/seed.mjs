#!/usr/bin/env node
/**
 * Seeds Firestore with the taxonomy the application expects: sections,
 * ingestion sources and the first administrator.
 *
 *   node scripts/seed.mjs --email you@example.org
 *
 * Requires Firebase Admin credentials in the environment (or .env.local):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   (or FIREBASE_SERVICE_ACCOUNT_JSON)
 *
 * Safe to re-run: documents are merged by id; nothing is deleted.
 */
import { readFileSync, existsSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value.replace(/\\n/g, "\n");
  }
}

loadEnvLocal();

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID. See .env.example.");
  process.exit(1);
}

const credential = serviceAccountJson
  ? cert(JSON.parse(serviceAccountJson))
  : clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey })
    : null;

if (!credential) {
  console.error("Missing service account credentials (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).");
  process.exit(1);
}

initializeApp({ credential, projectId });
const db = getFirestore();

const CATEGORIES = [
  ["cat-india", "india", "India", "भारत", 1, true],
  ["cat-politics", "politics", "Politics & Governance", "राजनीति और शासन", 2, true],
  ["cat-economy", "economy", "Economy & Employment", "अर्थव्यवस्था और रोज़गार", 3, true],
  ["cat-education", "education", "Education", "शिक्षा", 4, true],
  ["cat-health", "health", "Healthcare", "स्वास्थ्य", 5, true],
  ["cat-states", "states", "States", "राज्य", 6, true],
  ["cat-ground", "ground-reports", "Ground Reports", "ज़मीनी रिपोर्ट", 7, true],
  ["cat-factcheck", "fact-check", "Fact Check", "फ़ैक्ट चेक", 8, true],
  ["cat-environment", "environment", "Environment", "पर्यावरण", 9, true],
  ["cat-science", "science", "Science", "विज्ञान", 10, false],
  ["cat-tech", "technology", "Technology", "तकनीक", 11, false],
];

const SOURCES = [
  {
    id: "feed-pib",
    name: "Press Information Bureau — press releases",
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    publisher: "Government of India",
    type: "government",
    enabled: false,
    language: "en",
    lastStatus: "never",
    notes: "Primary government releases. Review robots policy and terms before enabling.",
  },
  {
    id: "feed-rbi",
    name: "Reserve Bank of India — press releases",
    url: "https://rbi.org.in/pressreleases_rss.xml",
    publisher: "Reserve Bank of India",
    type: "primary_record",
    enabled: false,
    language: "en",
    lastStatus: "never",
    notes: "Central bank notifications and circulars.",
  },
];

const emailArgIndex = process.argv.indexOf("--email");
const adminEmail = emailArgIndex > -1 ? process.argv[emailArgIndex + 1] : null;

async function main() {
  for (const [id, slug, nameEn, nameHi, order, showOnHome] of CATEGORIES) {
    await db.collection("categories").doc(id).set(
      { slug, nameEn, nameHi, order, showOnHome, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  console.log(`✓ ${CATEGORIES.length} categories written.`);

  for (const source of SOURCES) {
    const { id, ...rest } = source;
    await db.collection("sources").doc(id).set(rest, { merge: true });
  }
  console.log(`✓ ${SOURCES.length} ingestion sources written (all disabled by default).`);

  if (adminEmail) {
    try {
      const user = await getAuth().getUserByEmail(adminEmail);
      await db.collection("users").doc(user.uid).set(
        {
          email: adminEmail.toLowerCase(),
          name: user.displayName ?? "",
          role: "admin",
          status: "active",
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      console.log(`✓ ${adminEmail} granted the admin role.`);
    } catch (error) {
      console.warn(
        `! Could not grant admin to ${adminEmail}: ${error.message}. Create the account in Firebase Auth first, then re-run.`,
      );
    }
  } else {
    console.log("· No --email supplied; grant your first admin with: node scripts/seed.mjs --email you@example.org");
  }

  console.log("\nDone. Apply rules and indexes next:");
  console.log("  firebase deploy --only firestore:rules,firestore:indexes,storage");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
