# Deployment

Two things are true of this workspace and worth stating before any instructions:

1. **The application builds and runs.** `npm run build`, `npm start` and the 12
   integration tests all pass here, and the running preview you can open is that exact
   production build.
2. **No Vercel deployment was created from this session, and no GitHub push was made.**
   The Vercel account connected to this conversation (`ombuisness5@gmail.com`, team
   `team_DfPASZBxYBLg32Ro69uSGpvi`, Hobby plan) exposes project/deployment management
   tools, but a deployment needs either (a) a GitHub repository Vercel can pull from, or
   (b) the full source uploaded as deployment files. No GitHub repository is connected to
   this session, and no Vercel token is available to the sandbox, so neither path could be
   completed. Rather than report a deployment that does not exist, it is left for you with
   the exact steps below — roughly five minutes of work.

---

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
   Vercel Cron invokes it with the secret automatically on plans where cron is enabled.
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
