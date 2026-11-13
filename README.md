# Jan Drishti — जन दृष्टि

**See Beyond Headlines.**
_समाचार नहीं, सच्चाई का दृष्टिकोण।_

An independent Indian journalism and AI-assisted fact-checking platform, built as a
production application: Next.js 15 (App Router) + TypeScript + Tailwind, Firebase
(Firestore, Auth, Storage) as the primary backend, role-gated editorial tooling, and a
modular research pipeline whose machine output can never be published without a named
human editor.

---

## 1. What is actually here

| Area | Status |
| --- | --- |
| 22 required routes + admin sub-routes | ✅ implemented |
| Editorial design system (Bharat-flavoured broadsheet) | ✅ implemented |
| Bilingual EN/HI UI, navigation, forms and copy | ✅ implemented |
| Firestore data layer (articles, fact checks, submissions, corrections, audit, bookmarks, newsletter) | ✅ implemented (needs credentials) |
| Firebase Auth sessions + role-based access (admin / editor / researcher / user) | ✅ implemented (needs credentials) |
| Fact-check pipeline: extract → search → classify → compare → draft → human approval | ✅ implemented (search/AI need keys) |
| RSS ingestion with robots.txt compliance, dedupe, attribution, review queue | ✅ implemented (writes need Firestore) |
| Security rules for Firestore + Storage, indexes, server-side validation, rate limiting, audit logging | ✅ in repo |
| SEO: metadata, OG/Twitter, JSON-LD (NewsArticle, ClaimReview), sitemap, robots | ✅ implemented |
| Integration tests (route, validation, research→publish gate) | ✅ `npm test` |
| GitHub repository | ✅ https://github.com/Om9592/jan-drishti (public, `main`) |
| Vercel deployment | ✅ production live at https://jan-drishti-navy.vercel.app (see §10) |

When **no Firebase credentials** are present the app runs on a **labelled sample store**:
every page displays a "Preview build" banner, sample records carry a visible
`Sample content` chip, and sample stories are about *how the desk works* (methodology,
data literacy, corrections). No fabricated news events are presented as reporting.

---

## 2. Quick start

```bash
git clone <your-repo>  && cd jan-drishti
npm install
cp .env.example .env.local      # optional for a first run
npm run dev                     # http://localhost:3000
```

Without any environment variables the site boots in preview mode with sample content,
a working submission form, and a fully interactive (in-memory) editorial desk at `/admin`.

```bash
npm run build && npm start      # production build
npm test                        # integration tests (needs the server running)
```

---

## 3. Architecture

```
app/
  (public routes)                latest · india · politics · economy · education · health
                                 states · ground-reports · fact-check[/slug] · article[/slug]
                                 submit · search · about · editorial-policy
                                 fact-checking-methodology · corrections · contact
                                 funding · privacy · terms · login · profile
  admin/                         overview · submissions · fact-checks[/id] · articles[/id]
                                 corrections · taxonomy · users · audit
  api/                           auth/session · submissions[/id] · research
                                 fact-checks/[id] · articles[/status] · corrections
                                 newsletter · bookmarks · search · sources · users/role
                                 cron/ingest · health
components/
  layout/     Header (masthead, nav, mobile drawer, search dialog), Footer, SampleBanner
  ui/         ArticleCard, FactCheckCard, VerdictBadge, ArticleImage, SectionHeading,
              FilterBar, Pagination, ShareRow, BookmarkButton, NewsletterForm, EmptyState
  article/    SourceList, CorrectionNotice
  factcheck/  SubmissionForm, SubmitTabs, VerdictMeta
  admin/      AdminNav, ResearchRunner, TriageActions, ReviewForm, ArticleEditor,
              CorrectionForm, SourceControls, RoleSelect
lib/
  store/      DataStore interface + FirestoreStore + DemoStore (sample)
  research/   engine.ts (pipeline), providers.ts (AI + search + OCR adapters)
  security/   auth.ts (session cookies, role checks), rate-limit.ts
  ingestion/  rss.ts (robots-aware, dedupe, attribution, review queue)
  i18n/       EN + HI dictionaries and translator
  validation/ Zod schemas shared by client forms and API routes
  services/   research-service.ts (draft creation + approval gate)
```

**Single data-access seam.** Server components and route handlers call `getStore()`,
which returns `FirestoreStore` when the Admin SDK is configured and the labelled
`DemoStore` otherwise. Swapping the adapter changes nothing else in the app.

**The publish gate.** `runResearch()` returns `preliminary: true` always. Only
`publishFactCheck()` — reachable exclusively from a role-checked route — can set
`status: "published"`, `verifiedAt` and `reviewerName`.

---

## 4. Firebase setup

1. **Create a project** → <https://console.firebase.google.com>.
2. **Enable sign-in providers**: Email/Password and Google
   (Authentication → Sign-in method).
3. **Create Firestore** in production mode (region: `asia-south1` recommended).
4. **Create a Storage bucket** for screenshots and editorial imagery.
5. **Service account**: Project settings → Service accounts → Generate new private key.
   From the JSON, copy `project_id`, `client_email`, `private_key` into
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   (keep the `\n` escapes; Vercel handles them).
6. **Web config**: Project settings → Your apps → Web app config → copy the
   `NEXT_PUBLIC_FIREBASE_*` values.
7. **Authorised domains**: Authentication → Settings → Authorized domains → add
   `localhost` and your Vercel domain (e.g. `jan-drishti.vercel.app`).
8. **Rules and indexes**:

```bash
npm i -g firebase-tools
firebase login
firebase use --add                       # select your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

9. **Seed sections, sources and your first admin**:

```bash
node scripts/seed.mjs --email you@example.org
```

   (Create the account in Firebase Auth first, then re-run so the role is applied.)

### Collections

`users` · `articles` · `categories` · `sources` · `claims` · `evidence` · `factChecks`
· `submissions` · `corrections` · `auditLogs` · `translations` · `bookmarks` · `newsletter`

Pagination uses cursor-free `offset/limit` with `.count()` for totals; search uses a
`keywords` array (`array-contains-any`) written on every save. Indexes for every
compound query are in `firestore.indexes.json`.

---

## 5. Fact-check pipeline

```
submission ─► claim extraction ─► entity identification ─► query generation
           ─► evidence retrieval (configured providers only)
           ─► source classification (gov / primary / journalism / research / social)
           ─► supporting vs contradicting comparison ─► missing context
           ─► PRELIMINARY draft (never publishable) ─► editor review ─► published verdict
```

* Providers: any OpenAI-compatible chat completion (`AI_API_KEY`, `AI_BASE_URL`,
  `AI_MODEL`) and Tavily / Brave / Serper for search.
* **No provider ⇒ no invented evidence.** The report records the step as
  `unavailable`, recommends `UNVERIFIED`, and the UI says so.
* Verdicts: `verified_true`, `false`, `misleading`, `unverified`, `outdated`,
  `disputed`. Confidence: low / medium / high.
* Every published report carries: original claim, verdict, explanation, context,
  supporting evidence, contradicting evidence, all source URLs, dates, reviewer,
  confidence, correction history and a challenge route.

Try it: `/admin/fact-checks` → *Run research* → review → *Approve & publish*.

---

## 6. Ingestion

* Sources live in `sources/` and are **disabled by default** — enabling is an editorial act.
* `lib/ingestion/rss.ts` checks `robots.txt` before fetching, fails closed, de-duplicates
  by canonical-URL fingerprint, detects language (Devanagari ratio), assigns a section,
  and stores **headline + short attributed summary + canonical link only** — never full text.
* Ingested items are written with `status: "review"` and `kind: "external"`.
* Scheduled run: Vercel Cron hits `/api/cron/ingest` daily at 03:00 IST (21:30 UTC) — Hobby
  accounts reject more frequent cron; switch `vercel.json` to `0 */3 * * *` on Pro — with
  `Authorization: Bearer $CRON_SECRET` (see `vercel.json`).
* Manual run: `node scripts/ingest.mjs` or the *Fetch now* button per source.

---

## 7. Security model

* Firebase **session cookies** (httpOnly, `SameSite=Lax`, 5 days) created server-side from
  ID tokens; verification on every request via the Admin SDK.
* Roles read from `/users/{uid}.role` **server-side only** — a role in the browser is
  never trusted. `requireRole("editor")` protects publishing endpoints.
* Firestore rules deny all client writes to editorial collections; the admin SDK bypasses
  them from trusted server routes. Storage rules allow image-only uploads ≤ 5 MB.
* Zod validation on every API route; rich text is sanitised with an allow-list.
* Fixed-window rate limits on submissions (5/hour/IP), research (10/hour/user), search and
  newsletter. In-memory by default; swap the backend for Upstash/Redis on multi-instance
  serverless.
* IP addresses are stored only as salted SHA-256 hashes.
* Audit log records every editorial action with actor, target and summary.

**Demo-mode caveat, stated plainly:** when Firebase is not configured, `/admin` is open and
operates on an in-memory store so the workflow can be inspected. A loud banner says so and
nothing is persisted. Configure Firebase before treating any of it as a real newsroom.

---

## 8. Bilingual behaviour

* Language is a cookie (`jd_lang`) read on the server, so SSR and client agree — no flash.
* Hindi uses Noto Serif/Sans Devanagari with adjusted line-height; typography is tuned per
  script rather than inherited.
* Article `language` is a first-class field; `translationGroupId` links versions.
* Names, quotations, statutory language and court orders are never translated in ways that
  change meaning (see `/editorial-policy`).

---

## 9. Environment variables

See `.env.example`. None of the `NEXT_PUBLIC_*` values is a secret (the Firebase web
config is public by design). `FIREBASE_PRIVATE_KEY`, `AI_API_KEY`, `TAVILY_API_KEY`,
`CRON_SECRET` and `IP_HASH_SALT` are server-only.

Minimum for a live newsroom: the six `NEXT_PUBLIC_FIREBASE_*`, the three Firebase admin
values, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`. Without `AI_API_KEY`/search keys the
fact-check desk still works — it just does everything manually, and says so on the page.

---

## 10. Git / GitHub / deployment status

**GitHub — done.** The repository is public at
<https://github.com/Om9592/jan-drishti>, `main` branch, 137 files, no secrets committed
(`.env.example` is the only env file; `.gitignore` excludes `.env*`, service-account JSON
and `.next`).

**Vercel — done.** Project `jan-drishti`
(`prj_4XJpM7VVGcAFN0NJiFSAIPhC2Lk8`, team `team_DfPASZBxYBLg32Ro69uSGpvi`) is connected to
the GitHub repo, so every push to `main` redeploys.

| | |
| --- | --- |
| Production URL | <https://jan-drishti-navy.vercel.app> |
| Git branch URL | `jan-drishti-git-main-ombuisness5-2169.vercel.app` |
| Environment | Hobby, Node 26.x, region `iad1`, Next.js preset |
| Env vars set | `NEXT_PUBLIC_SITE_URL`, `IP_HASH_SALT` (sensitive) |
| Cron | `/api/cron/ingest` daily 21:30 UTC (Hobby rejects sub-daily schedules) |
| Verified after deploy | 29 routes return 200, `/api/health` returns 200 |

Two honest notes:

1. The **team's other hostnames** (`jan-drishti-ombuisness5-2169.vercel.app`,
   `*.vercel.app` deployment URLs) sit behind Vercel **Deployment Protection**, so an
   anonymous visitor gets the Vercel login page there. `jan-drishti-navy.vercel.app` is the
   unprotected production alias and serves the site normally. Turn protection off project-wide
   under Settings → Deployment Protection if you want the generated URLs public too.
2. The site currently runs in **preview mode on Vercel** (`/api/health` → `"backend":
   "sample"`) because no Firebase credentials are set in the Vercel project yet. Add them and
   redeploy to switch to Firestore.

## 11. Testing

```bash
npm run build
npm start &            # serves http://127.0.0.1:3000
npm test               # 12 integration tests
```

Covered: every public route renders, detail pages expose sources and structured data,
404s, security headers, robots/sitemap, health/capability reporting, submission validation
(short content, missing consent, bad email), successful submission references, research
output remaining preliminary and UNVERIFIED without search, the publish gate rejecting an
unexplained verdict and accepting a complete one, newsletter validation, and admin access
behaviour.

Also verified manually at 1440 / 1024 / 768 / 390 / 360 px: no horizontal overflow on any
tested route (`documentElement.scrollWidth <= clientWidth`).

---

## 12. Known limits

* No payment, subscription or newsletter-delivery integration — the newsletter stores an
  address and nothing else.
* Ingestion is RSS-first; licensed aggregator APIs are stubbed behind `NEWS_API_KEY` and
  must be enabled per contract terms.
* No translation editor UI; `translations` and `translationGroupId` exist in the schema and
  in the admin article editor via the `language` field, but linked-pair management is manual.
* Rate limiting is per-instance until a shared store is configured.
* Sample imagery is illustrative and labelled; never presented as documentary photography.

---

## 13. Licences and attribution

Application code in this repository is the project's own work. News content must come from
configured feeds, licensed APIs, official releases or original reporting — the ingestion
layer deliberately stores only headline, short summary and canonical link so publisher
copyright is respected.

---

_Jan Drishti is a demonstration newsroom brand created for this build. Replace the trust
name, contact addresses and funding disclosures with your own before publishing anything._
