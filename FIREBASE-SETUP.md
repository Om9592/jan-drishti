# Firebase setup — current state

Project `jan-dristi` (project number `600606430085`).
Last actioned: 13 November 2026, from this workspace with the `firebase-adminsdk-fbsvc@jan-dristi.iam.gserviceaccount.com` service account.

## Done and verified

| Item | Evidence |
| --- | --- |
| Firestore database | `projects/jan-dristi/databases/(default)`, `FIRESTORE_NATIVE`, location **`nam5`** (US multi-region) |
| Firestore security rules | ruleset deployed, release `cloud.firestore` updated (`firebaserules` API returned 200) |
| Sections seeded | 11 documents in `categories` |
| Ingestion sources seeded | 2 documents in `sources`, both **disabled** |
| Auth — Email/Password | enabled |
| Auth — Anonymous / Phone | **disabled** (they were on by default; anonymous auth would let anyone hold a token) |
| Auth — authorised domains | `localhost`, `jan-dristi.firebaseapp.com`, `jan-dristi.web.app`, `jan-drishti-navy.vercel.app`, `jan-drishti-ombuisness5-2169.vercel.app` |
| Server-side wiring | `/api/health` returns `"backend": "firestore"`, `"demo": false` |
| End-to-end write | a POST to `/api/submissions` created a real Firestore document + `auditLogs` entry, then was deleted again to leave a clean database |
| Public pages on Firestore | `/`, `/latest`, `/fact-check`, `/admin`, `/editorial-policy` all 200 against the real database |

## Still needed (two of these need your console access)

### 1. Composite indexes — required for full performance
The service account has data access but **not** `datastore.indexes.create`, so index creation was refused:
`403 The caller does not have permission`.

Until they exist, `lib/store/firestore.ts` falls back to fetching the filtered set and sorting it in memory
(capped at 500 documents, with a `[firestore] missing composite index …` warning in the logs). The site works;
it just isn't using the database efficiently yet.

Fix — either one:

```bash
# from the repository, signed in with your own Google account
firebase login
firebase use jan-dristi
firebase deploy --only firestore:indexes
```

or in Google Cloud console → IAM, give the service account the **Cloud Datastore Owner**
(`roles/datastore.owner`) or **Firebase Admin** role, and the 14 indexes in `firestore.indexes.json`
can be created from here in one pass.

### 2. Storage bucket — needs billing
`POST /storage/v1/b` returned:
`403 The billing account for the owning project is disabled in state absent`.

Firebase Storage requires the **Blaze** (pay-as-you-go) plan. On Spark, the bucket cannot be created at all.
Consequences today: screenshot uploads in the claim form are disabled, the article editor takes an image URL
instead of a file, and Storage rules are written but undeployed.

Fix: Firebase console → **Upgrade** to Blaze → Storage → *Get started* → then
`firebase deploy --only storage`.

### 3. Google sign-in — console toggle
Email/password works. Google sign-in needs the provider switched on in
**Authentication → Sign-in method → Google** (the Admin API path for default IdPs is not exposed to
service accounts); the login page already renders the button and will use it once enabled.

### 4. Your first admin account
Create the account (Firebase Auth → Users → Add user, or sign up at `/login`), then either:

```bash
FIREBASE_PROJECT_ID=jan-dristi \
FIREBASE_SERVICE_ACCOUNT_JSON="$(cat serviceAccount.json)" \
node scripts/seed.mjs --email you@example.org
```

or say the word and it can be granted from here — role lives in `users/{uid}.role` and is only ever read
server-side.

## Environment variables in Vercel

Set for **production + preview**: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY` (sensitive), plus the six `NEXT_PUBLIC_FIREBASE_*` values.
`NEXT_PUBLIC_SITE_URL`, `IP_HASH_SALT`, `CRON_SECRET` were already set.

## Security follow-ups

- **Rotate the service-account key** once setup is finished (Google Cloud console → IAM → Service accounts →
  keys → delete this key, create a new one, update `FIREBASE_PRIVATE_KEY` in Vercel). The key was shared over
  chat and should be treated as exposed. It was never written into the repository or a workspace file.
- Consider recreating the database in `asia-south1` if read latency from India matters — `nam5` was chosen
  when the database was created and cannot be changed in place, only recreated before real content exists.
