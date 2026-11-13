# Delivery status — Jan Drishti

Written 13 November 2026. Everything below was verified in this workspace; nothing is
asserted that was not executed. Where something could not be done, it says so plainly.

## Phase D — freelance contributors, real images, AI multi-source fact-check (13 Nov 2026)

### Verified by execution in this session

| Check | Method | Result |
| --- | --- | --- |
| Contributor application → approval → account | live Firestore + Auth via `node` script against a local build | ✅ submission stored, admin PATCH created the Auth user, custom claim `role: contributor`, password-set mail sent |
| Contributor cannot self-publish | POST `/api/articles` as a contributor with `status: "published"` | ✅ stored as `review`, byline forced to the filing account, `featured/underreported/groundReport` cleared |
| Unapproved story is invisible | GET `/article/<slug>` before approval | ✅ 404; after admin publish → 200 with the contributor's byline |
| Ownership guard | contributor posts with another author's article id | ✅ 403 / rejected; the desk page never lists another writer's copy |
| Contributor desk | `/contribute/desk`, `/contribute/desk/new`, `/contribute/[id]` | ✅ 200 as contributor, 307 to `/login` as anonymous, mobile 390 px clean |
| Admin queue | `/admin/contributors` as admin | ✅ pending pitch, approve/decline, "awaiting approval" queue with one-click publish, roster |
| Wire images | home / latest / india / politics / economy / education / health / states / science / environment / technology | ✅ 14 wire cards per page, 2–10 publisher thumbnails each, 0 broken images (Playwright `naturalWidth` check) |
| Keyless evidence retrieval (local + live) | POST `/api/research` with no AI or search keys | ✅ live production: **27 results from 18 publishers**, 12 counted independent, **0.63 s**; steps show `search done`, `corroborate done` |
| Deployed build | Vercel production, commit `0d820c5` | ✅ READY and promoted to `jan-drishti-navy.vercel.app`; 21-route live sweep 200, 10 sections × 14 wire cards, 3–12 publisher thumbnails each, 0 broken images |
| Live contributor endpoint | POST `/api/contributors` against production | ✅ real submission stored in Firestore, visible in `/admin/contributors`, then deleted |
| Independence gate | same run, `independentSources` | ✅ counted and surfaced; verdict held at `unverified` with no AI key, and a model verdict of true/false is downgraded below 3 publishers |
| Type check / build | `npx tsc --noEmit`, `npm run build` | ✅ clean |

### New in Phase D

- **Freelance contributor programme**: `/contribute` (public pitch form, no account
  needed), `/admin/contributors` (approve → creates the account, grants the
  `contributor` claim, mails a password-set link; one-click publish for contributed
  stories), `/contribute/desk` (own drafts only, stats, status explained),
  `/contribute/desk/new` and `/contribute/desk/[id]` (editor with no publish button,
  read-only status and byline). `POST /api/articles` forces byline + `review` for
  contributors and refuses edits to anyone else's story.
- **Wire images and section coverage**: publisher thumbnails now parse
  (`media:content`, `media:thumbnail`, `enclosure`, `<img>`) and render hotlinked
  with a `Photo: <Publisher>` credit; `/science`, `/environment`, `/technology`
  added; `/latest` and `/states` merge the wire; each section fetches only its own
  feeds with a 21-day window, so no section renders empty.
- **AI multi-source fact-check**: keyless evidence layer (Google News RSS, Bing News
  RSS, trusted wire, Wikipedia) that always runs; a hard 3-independent-source
  corroboration gate before any yes/no recommendation; provider presets so one
  `AI_API_KEY` (`AI_PROVIDER=gemini|groq|openai|openrouter|deepseek`) enables
  synthesis; `sourcesUsed` / `independentSources` / `durationMs` recorded and shown
  in the review screen.
- **Bugs fixed on the way**: categories/sources/submissions/corrections returned
  Firestore `Timestamp` objects to Client Components, which crashed
  `/admin/articles/new` and `/contribute/desk/new` with a 500 — all store reads now
  deep-convert to plain JSON; `categorySlug` could be `undefined` (Firestore rejects
  it) when a section arrived as a slug; `articleSchema` rejected `imageUrl: null` and
  a missing `authorId`.

### Still needs the owner's accounts (cannot be done from code)

| Gap | What is blocked | What fixes it |
| --- | --- | --- |
| AI synthesis | No model key on the deployment, so the model never runs; the desk gets the evidence file only | Add `AI_API_KEY` (+ `AI_PROVIDER`) in Vercel → the same run then cross-checks sources and recommends a verdict in seconds |
| Composite indexes | 14 queries fall back to in-memory sorting past ~500 docs | `firebase deploy --only firestore:indexes` or create them in the console |
| Image uploads | Storage bucket needs the Blaze plan | Upgrade the Firebase project, then set the bucket |
| Google sign-in | Google IdP is disabled for the project | Enable it in Firebase console → Authentication → Sign-in method |

## 1. Verified in this session

| Check | Command / method | Result |
| --- | --- | --- |
| Production build | `npm run build` | ✅ compiled successfully, 31 routes emitted |
| Type check | `npx tsc --noEmit` | ✅ no errors |
| Integration tests | `npm test` (server on :3000) | ✅ 12/12 pass |
| Route smoke test | HTTP GET on every public + admin route | ✅ 200 (404 for unknown slugs, as designed) |
| Browser console | Playwright on 9 routes | ✅ no page errors, no failed requests |
| Responsive overflow | 11 routes × 1440/1024/768/390/360 px | ✅ `scrollWidth == clientWidth` everywhere |
| Visual review | full-page screenshots, desktop + 390 px | ✅ masthead, nav, hero, article, fact-check report, admin desk |
| Git history | `git log` | ✅ 5 commits, 137 tracked files, secrets excluded |
| GitHub push | GitHub API | ✅ https://github.com/Om9592/jan-drishti (public, `main`) |
| Vercel deployment | Vercel API | ✅ READY — https://jan-drishti-navy.vercel.app |
| Live route check | 29 `curl` requests to production | ✅ all 200 |
| Integration tests on live site | `BASE_URL=https://jan-drishti-navy.vercel.app npm test` | ✅ 12/12 pass |
| Browser check on live site | Playwright, home + report, console + failed requests | ✅ clean |
| Canonical / OG / sitemap | fetched from production | ✅ all use `https://jan-drishti-navy.vercel.app` |
| Firebase Firestore | Admin API probe | ✅ database created, rules deployed, 11 sections + 2 sources seeded |
| Firebase Auth | Identity Toolkit Admin API | ✅ email/password on, anonymous/phone off, Vercel domain authorised |
| End-to-end Firestore write | POST `/api/submissions` → read back with Admin SDK | ✅ real document + audit log, then cleaned up |
| Live wire (real news) | 10 RSS feeds fetched server-side, cached 10 min | ✅ The Hindu, Mint, NDTV, RBI — headlines on Top Stories / Latest / every section, attributed and linked out |
| Responsive check with wire content | 6 routes × 1440/768/390/360 | ✅ no horizontal overflow |

## 2. Implemented (working code, no external accounts needed to run)

- **22 required pages** plus `funding`, `privacy`, `terms`, `not-found`, `error`, and 8
  admin screens (overview, submissions, fact checks + detail, articles + new/detail,
  corrections, taxonomy, users, audit).
- **Editorial design system**: navy/paper/gold palette, Newsreader + Inter + Noto
  Devanagari, thin rules, asymmetric grid, restrained motion, mobile-first layouts.
- **Bilingual EN/HI** through a server-read cookie, per-script typography, and an
  article-level `language` + `translationGroupId` model.
- **Article experience**: provenance labels (original / summary / external / opinion),
  reading time, source list, correction history, share row, bookmark toggle.
- **Fact-checker intake**: text, URL and screenshot tabs with validation, consent, rate
  limiting, and a human-readable reference number.
- **Research pipeline** with per-step status (`pending / done / unavailable / error`),
  verdict taxonomy, both-sides evidence, confidence, reviewer.
- **Admin workflow** with roles admin/editor/researcher/user resolved server-side, a
  machine-output → editor-approval publish gate, and an audit log.
- **Search & filters** (query, section, state, language, date, sort) with pagination.
- **Security**: session cookies, Zod validation on every route, sanitised rich text,
  rate limits, upload-type/size validation, security headers, Firestore + Storage rules,
  14 composite indexes.
- **SEO**: metadata, OG/Twitter, canonical, `NewsArticle` + `ClaimReview` + breadcrumb
  JSON-LD, sitemap, robots.
- **Ingestion module**: robots.txt-aware RSS fetch, URL-hash de-dupe, language detection,
  attribution-only summaries, review queue, Vercel Cron entry point.
- **Honest failure modes**: no search provider ⇒ UNVERIFIED; no AI key ⇒ "manual review,
  no recommendation"; no Firebase ⇒ visibly labelled sample store.

## 3. Needs your credentials to activate (code complete)

| Item | Variable(s) | Behaviour until configured |
| --- | --- | --- |
| Firestore read/write | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | ✅ configured — live database |
| Firebase Auth (email + Google) | `NEXT_PUBLIC_FIREBASE_*`, authorised domains | ✅ email/password live; Google needs a console toggle |
| Screenshot uploads | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` + storage rules | Upload field disabled |
| AI drafting | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Report marked "manual review required" |
| Evidence search | `TAVILY_API_KEY` / `BRAVE_API_KEY` / `SERPER_API_KEY` | No evidence retrieved ⇒ UNVERIFIED |
| Scheduled ingestion | `CRON_SECRET` | Endpoint 401s; manual runs only |
| Shared rate limiting | Upstash/Redis URL (optional) | Per-instance memory limits |

## 4. Needs Firebase console work (yours, ~15 minutes)

1. Create the project, enable Email/Password + Google, Firestore, Storage.
2. `firebase deploy --only firestore:rules,firestore:indexes,storage`.
3. `node scripts/seed.mjs --email you@example.org` for sections, sources, first admin.
4. Add the Vercel domain to Authentication → Authorized domains.

## 5. Needs editorial staff (not software)

- Named editor to approve every verdict; researcher to triage the queue.
- Signed-off editorial policy, corrections policy and ownership/funding disclosure — the
  pages exist and are written, but the trust name, addresses and funding text must be
  replaced with your real organisation's.
- Licensed or original content. No reporting is included; sample stories describe the
  desk's own methods and are labelled.

## 6. Not implemented — stated rather than implied

- **Payments / subscriptions**: none. Newsletter capture stores an address only.
- **Newsletter delivery**: no ESP integration; the endpoint records consent and nothing else.
- **Translation editor UI**: schema supports linked EN/HI pairs; managing them is manual.
- **Licensed news APIs**: adapters are stubbed behind `NEWS_API_KEY`; must be enabled per
  contract.
- **Real newsroom content**: none of Jan Drishti's *own* reporting exists yet, by design. What
  readers see in Top Stories and Latest News is the **wire** — headlines from The Hindu, Mint,
  NDTV and RBI, labelled as another publisher's reporting and linked to the source.
- **Perfect objectivity**: not claimed anywhere in the product or these documents.
- **Public access to every hostname**: Vercel Deployment Protection still covers the
  generated `*.vercel.app` deployment URLs; the `jan-drishti-navy.vercel.app` production
  alias is public. Disabling protection is a dashboard toggle the connector does not expose.

## 7. Where to look

- `README.md` — architecture, Firebase setup, pipeline, security model, env checklist.
- `DEPLOYMENT.md` — deployment options, post-deploy checklist, what stays manual.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — backend security.
- `tests/integration.test.mjs` — the assertions behind the ✅ marks above.
- `lib/research/engine.ts` — the fact-check pipeline and its honesty rules.
- `lib/store/` — the `DataStore` seam between Firestore and the labelled sample store.
