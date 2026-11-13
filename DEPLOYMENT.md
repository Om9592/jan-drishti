# Deployment

## Status: deployed

| | |
| --- | --- |
| GitHub | <https://github.com/Om9592/jan-drishti> — public, `main` |
| Vercel project | `jan-drishti` (`prj_4XJpM7VVGcAFN0NJiFSAIPhC2Lk8`) |
| **Live production URL** | **<https://jan-drishti-navy.vercel.app>** |
| Build | READY, Next.js preset, Node 26.x, region `iad1` |
| Verified | 29 routes → 200, `/api/health` → 200, sitemap + robots served |
| Cron | `/api/cron/ingest` daily at 21:30 UTC |
| Env vars | `NEXT_PUBLIC_SITE_URL`, `IP_HASH_SALT` |

Pushes to `main` redeploy automatically. The `*.vercel.app` per-deployment hostnames are
covered by Vercel Deployment Protection (they redirect to a Vercel login); the
`jan-drishti-navy.vercel.app` alias is the public one. Disable protection in
**Settings → Deployment Protection** if you want every URL open.

The rest of this file is the manual checklist for the steps that still need your accounts.



## Option A — GitHub → Vercel (recommended, gives you the Git URL you asked for)

The repository already has a clean commit history locally (`git log`), with `node_modules`,
`.env*`, `.next` and service-account JSON excluded by `.gitignore`.

```bash
cd jan-drishti
git remote add origin git@github.com:<your-account>/jan-drishti.git
git push -u origin main
```

Then in Vercel: **Add New → Project → Import** the repository.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js (auto-detected) |
| Root directory | `./` |
| Build command | `npm run build` (default) |
| Output directory | default |
| Install command | `npm install` (default) |
| Node.js version | 20.x or later |

No environment variables are required for the first successful deploy — the app boots into
the labelled preview mode. Add the Firebase values afterwards (see README §4 and
`.env.example`) and redeploy.

Vercel redeploys automatically on every push to `main` once the project is connected.

## Option B — Vercel CLI, from this machine

```bash
npm i -g vercel
vercel login                     # interactive, in your own terminal
vercel link                      # create/attach the jan-drishti project
vercel env add FIREBASE_PROJECT_ID production   # repeat per variable
vercel --prod
```

After the first deploy:

```bash
vercel domains ls                # confirm the *.vercel.app hostname
```

## Post-deploy checklist

1. **Set the site URL.** `NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app` — used by
   canonical links, Open Graph URLs, `sitemap.xml` and `robots.txt`.
2. **Firebase authorised domains.** Firebase console → Authentication → Settings →
   Authorized domains → add `<project>.vercel.app`. Without this, Google sign-in fails
   with `auth/unauthorized-domain` (email/password sign-in is unaffected).
3. **Firebase Admin credentials.** Add `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY` as *server-only* variables (Production + Preview). Keep the
   `\n` sequences in the private key; Vercel handles them. Never prefix them with
   `NEXT_PUBLIC_`.
4. **Cron secret.** Generate one (`openssl rand -hex 32`) and set `CRON_SECRET`. The same
   value authorises `/api/cron/ingest`, which `vercel.json` schedules every three hours.
   Vercel Cron invokes it with the secret automatically where cron is enabled.
   **Schedule note:** `vercel.json` runs ingestion once daily at 21:30 UTC (03:00 IST) because Hobby accounts reject anything more frequent than daily. On Pro, change the expression to
   `0 */3 * * *` for three-hourly runs — a deployment with the daily expression on Hobby was
   the first thing Vercel's API refused, so it is now the committed default.
5. **Deploy Firebase rules and indexes** (`firebase deploy --only
   firestore:rules,firestore:indexes,storage`) against the same project, then seed the
   taxonomy: `node scripts/seed.mjs --email you@example.org`.
6. **Promote your first admin.** Create the account in Firebase Auth, re-run the seed
   script with `--email`, sign in, then confirm `/admin` resolves instead of redirecting.
7. **Verify the live site.** `/api/health` should report `"backend": "firestore"` once
   credentials are in place; while it says `"sample"` the site is still in preview mode and
   the banner will tell you so.
8. **Rate limiting.** Defaults are per-instance in memory. On serverless, point the
   limiter at a shared store (Upstash Redis or similar) before publishing anything that
   attracts a crowd.
9. **Turn off sample content.** Once real reporting exists, sample records stop being
   seeded automatically; verify the preview banner no longer appears in production.

## What stays manual because it needs your accounts

| Item | Why it cannot be done from here |
| --- | --- |
| GitHub repository + push | No GitHub credentials/connector authorised in this session |
| Vercel deployment | Needs a Git source or a Vercel token; the connector cannot upload this source tree |
| Firebase project, rules deploy, Auth providers | Requires your Google/Firebase console access |
| AI + search provider keys | Requires your accounts with OpenAI-compatible / Tavily / Brave / Serper |
| Domain names, DNS | Requires your registrar |
| Editorial staff accounts | Requires real people and an editorial policy signed off by them |
