# Delivery status — Jan Drishti

Written 13 November 2026. Everything below was verified in this workspace; nothing is
asserted that was not executed. Where something could not be done, it says so plainly.

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
| Git history | `git log` | ✅ 2 commits, 135 tracked files, secrets excluded |

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
| Firestore read/write | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | In-memory sample store, banner shown |
| Firebase Auth (email + Google) | `NEXT_PUBLIC_FIREBASE_*`, authorised domains | Sign-in returns a clear 503, not a fake session |
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

- **GitHub push**: no GitHub credentials or connector were authorised in this session, so
  the repository exists only locally. `DEPLOYMENT.md` has the two commands to publish it.
- **Vercel deployment**: not created. The connected Vercel account is on the Hobby plan and
  this session had neither a Git-backed repository for Vercel to pull nor a token to upload
  source; the connector cannot transmit this source tree. `DEPLOYMENT.md` lists the exact
  dashboard and CLI paths, including env vars and post-deploy checks.
- **Payments / subscriptions**: none. Newsletter capture stores an address only.
- **Newsletter delivery**: no ESP integration; the endpoint records consent and nothing else.
- **Translation editor UI**: schema supports linked EN/HI pairs; managing them is manual.
- **Licensed news APIs**: adapters are stubbed behind `NEWS_API_KEY`; must be enabled per
  contract.
- **Real newsroom content**: none, by design. Production shows honest empty states.
- **Perfect objectivity**: not claimed anywhere in the product or these documents.

## 7. Where to look

- `README.md` — architecture, Firebase setup, pipeline, security model, env checklist.
- `DEPLOYMENT.md` — deployment options, post-deploy checklist, what stays manual.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — backend security.
- `tests/integration.test.mjs` — the assertions behind the ✅ marks above.
- `lib/research/engine.ts` — the fact-check pipeline and its honesty rules.
- `lib/store/` — the `DataStore` seam between Firestore and the labelled sample store.
