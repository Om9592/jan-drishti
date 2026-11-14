# Delivery status — Jan Drishti

Written 13 November 2026. Everything below was verified in this workspace; nothing is
asserted that was not executed. Where something could not be done, it says so plainly.

## Phase F — the checker becomes a chat (13 Nov 2026)

A reader can now hold a conversation with the checker: type a claim in English,
Hindi or Hinglish, watch the stages, and read the answer as it is written, with
numbered citations that jump to the source.

| Check | Result |
| --- | --- |
| Chat page | `/ask` — bubbles, staged progress, streaming tokens, stop button, new chat, session-persisted history, mobile safe |
| Streaming | server-sent events: `open` → `status` ×3 → `delta` ×N → `done`, with 8 s heartbeats so no proxy drops a long run |
| A false viral claim | "RBI has stopped printing ₹500 notes" → **false**, 15 publishers, sources include FACTLY, CyberPeace fact-check, Outlook Money, Economic Times |
| A true viral claim | "Yamuna mein zehrile jhaag wapas" → **verified_true**, 5 independent publishers (NDTV, TOI, HT, Newslaundry, TNIE), answered in Hindi |
| Hinglish in, Hinglish out | the reply follows the language of the question, not the interface |
| Every answer logged | written to `publicChecks` with `kind: "chat"`, visible on `/admin/ai-checks` as a chat turn |

### Three bugs this phase found, and the fix

1. **Retrieval was fetching the wrong story.** "Is it true that the RBI has
   withdrawn ₹500 notes?" produced the queries `"true withdrawn"` — question words
   became search terms — and the evidence came back as stories about US bombers
   and church attendance, which the models then reasoned about in perfect
   confidence. Fixes: question/filler words (English, Hindi and Hinglish) are now
   stopwords; acronyms are recognised as entities; queries are built from the
   subject plus its figures. The same claim now returns FACTLY, Outlook Money and
   the government's rebuttal.
2. **Every three-letter acronym was being thrown away.** The entity filter kept
   words longer than three characters — so RBI, CBI, WHO and NIA never counted,
   and the relevance gate had nothing to match on.
3. **Off-topic results were treated as evidence.** A hit now has to share the
   claim's named subject (or, for claims with no named subject, two content words
   or a figure). Stories about 3D printers no longer reach the models.

### Reliability engineering added here

- **A wall-clock budget** (`CHAT_BUDGET_MS`, default 55 s). Free tiers rate limit
  hard; the run used to take 193 s because each provider was retried after a 429.
  Retry sleeps are now skipped past the deadline, and the answer says what it
  skipped ("re-check skipped — out of time budget") instead of pretending.
- **Real streaming** (`aiStream`): the answer types itself out token by token, and
  a provider only counts as having answered once its first token arrives, so
  failover still works.
- **Self-verifying writes**: the record is read back from Firestore, and the UI
  says so if the desk did not receive it.
- If every model fails, the reader still gets an answer assembled from the
  retrieved evidence, flagged `assembled-reply` — never a fabricated verdict.

## Phase E — instant self-serve answers, reporting-only desk (13 Nov 2026)

A reader asks, the machine answers, and the desk gets a record. There is no approval
step between the question and the answer; nothing is created in the fact-check archive.

| Check | Method | Result |
| --- | --- | --- |
| Public ask works with no account | POST `/api/fact-check/ask` from a cold client | ✅ 200 in **19.4 s**, 16 evidence items, 11 publishers, answer rendered inline |
| Multiple models on one claim | same run | ✅ `gemini-3.5-flash` + `groq/openai/gpt-oss-120b` + `groq/openai/gpt-oss-20b`, all `unverified`; re-check `groq (gpt-oss-20b) confirmed after reading 3 analyst reports` |
| Sources are shown, not just claimed | answer payload + UI | ✅ 8 source links with real publisher names (NDTV, Times of India, Newslaundry, Deccan Herald, TNIE, ThePrint) |
| Bad input is refused cheaply | POST with a 5-character claim | ✅ 422 with a field message, no model call |
| Capability probe | GET `/api/fact-check/ask` | ✅ `{"ai":true,"model":"gemini-3.5-flash","providers":["gemini","groq","pollinations"],"rateLimitPerHour":6}` |
| Answer card renders | Playwright, 1280 px | ✅ verdict, confidence, three evidence columns, source list, cross-check line, machine-output disclaimer, **0 page errors** |
| Type check / build | `npx tsc --noEmit`, `npm run build` | ✅ clean; routes `/api/fact-check/ask`, `/admin/ai-checks` present |

### Verified in production (`jan-drishti-navy.vercel.app`, commit `01a8c10`)

| Check | Result |
| --- | --- |
| Public ask, no account | 200 in **19.6 s**; 16 evidence items, **16 publishers**; sources shown: India Today, The New Indian Express, The Times of India, Scroll.in, The Indian Express, Al Jazeera |
| Three models per claim | `gemini-3.5-flash`, `groq/openai/gpt-oss-120b`, `groq/openai/gpt-oss-20b` — all `unverified`; re-check `groq (gpt-oss-20b) confirmed after reading 3 analyst reports` |
| Desk record written | ✅ `recorded: true`, read back from Firestore before the answer is returned |
| Machine answer is not an archive verdict | ✅ claim text absent from `/fact-check` |
| Desk log closed to strangers | ✅ `/admin/ai-checks` says "You do not have editorial access"; the report is not in the RSC payload and the claim never appears |

### Two bugs the live run caught

1. **The desk record was not being written.** A Firestore document may not contain an
   `undefined` value and sources carry optional fields, so every write threw while the
   reader still got an answer. The record is now written in JSON form, with a minimal
   fallback, and the answer carries `recorded` — read back, not assumed. The card tells
   the reader if the desk could not be notified.
2. **A desk page rendered for strangers.** `/admin/ai-checks` showed the access-denied
   panel, but the layout and the page render in parallel, so the page body still ran and
   was serialised into the stream. Both desk pages now check the role before touching
   the database.

### Known limitation, stated plainly

Three live claims in a row came back `unverified`. That is the honesty rule working —
none of the retrieved reports actually addressed the specific numbers or announcements —
but it also shows the bottleneck is **retrieval, not the models**: a viral claim gets a
decisive verdict only when the search finds a report that speaks to it directly. Next
step would be claim-aware query variants and per-claim source targeting.

### How it is wired

- `app/api/fact-check/ask/route.ts` — public POST. Rate limited per visitor
  (`PUBLIC_CHECK_RATE_LIMIT`, default 6/hour), returns the answer inline,
  `maxDuration = 300` so a 20–60 s research run completes.
- `lib/services/public-checks.ts` — runs the same evidence-first pipeline the desk uses
  (`runResearch`), shapes a reader-facing answer, and writes a record to the
  `publicChecks` collection: claim, verdict, confidence, all three analysts, the
  re-check line, publishers, duration, model, flags, hashed IP.
- `components/factcheck/AskAiForm.tsx` — the ask box and answer card on `/fact-check`.
  Shows staged progress while the run happens, the evidence, and every source with its
  publisher.
- `app/admin/ai-checks/page.tsx` — **reporting only**: every answer the public received,
  with its evidence count, models, flags and re-check line. No publish button, because
  the answer is already out. An editor who wants a signed verdict creates one on the
  editorial desk instead.

### Invariants kept

- Machine answers are never written into `factChecks`; the archive stays human-signed.
- The answer says `unverified` when the evidence is thin, and surfaces analyst
  disagreement (`flags: analysts-split`, `thin-sourcing`, `no-re-check`) instead of
  averaging it away.
- No source is invented: every link in the answer came from the retrieval layer.
- Submitter identity is never shown to the public; only a salted IP hash is stored.

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
  in the review screen. One model call per run by default (`RESEARCH_AI_EXTRACTION=0`):
  deterministic queries already retrieve the evidence, so the single call is spent
  on the verdict. Every provider failure — retired model id, rejected key, timeout,
  exhausted free-tier quota — is named in the run's steps, never hidden behind
  "did not respond".
- **Bugs fixed on the way**: categories/sources/submissions/corrections returned
  Firestore `Timestamp` objects to Client Components, which crashed
  `/admin/articles/new` and `/contribute/desk/new` with a 500 — all store reads now
  deep-convert to plain JSON; `categorySlug` could be `undefined` (Firestore rejects
  it) when a section arrived as a slug; `articleSchema` rejected `imageUrl: null` and
  a missing `authorId`.

### Still needs the owner's accounts (cannot be done from code)

| Gap | What is blocked | What fixes it |
| --- | --- | --- |
| AI cross-check | Every claim is read **independently by two models** — Gemini and Groq's `gpt-oss-120b`, with a second Groq model (`gpt-oss-20b`) and the keyless endpoint filling in when a key is out of quota — over the same 10 strongest evidence items from 10+ publishers, then **re-checked once** by a model that reads both reports and the evidence and can confirm, correct or overturn. Unanimity is stated; a split is itself a finding and cannot be stronger than UNVERIFIED. Each analyst's verdict, confidence and dissent is stored on the report and shown in the review screen | Nothing to buy: Groq's free tier is the workhorse (fast, generous), Gemini free tier adds a second vendor, keyless endpoint is the last resort |
| AI provider chain | Providers are tried in order — your key, then any other free key in the env, then a **keyless free endpoint** (Pollinations, open-weights `gpt-oss-20b`, no signup, no card, ≈1 answer/45 s/IP). A dead key, a retired model id, a timeout or an exhausted quota hands the run to the next provider instead of failing it | Nothing to buy. For better answers, paste any free key (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`) in Vercel → it is used before the keyless endpoint |
| AI synthesis quota | `AI_API_KEY` is configured in Vercel (`gemini-3.5-flash`) and the synthesis is verified working — but a **Free Tier key allows 20 generate-content requests per day per model**, and one research run is one call. Past the cap the provider answers `429` and the run honestly reports "free-tier daily quota exhausted" instead of inventing a verdict | Enable billing on the Gemini API key (pay-as-you-go), or wait for the daily reset, or point `AI_PROVIDER`/`AI_API_KEY` at another provider (groq/openai/openrouter/deepseek presets exist) |
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

### Phase G — verify against the latest news, and show the sources

The reader's complaint was that every answer said `unverified`, even for a story
every outlet was carrying, and that nothing pointed at the reporting.

- Google News is searched inside a 7-day window first; Bing is sorted by date;
  hits are deduped and ordered newest-first. A second, un-windowed pass runs when
  the fresh window cannot settle the claim, so an old rumour is still settled by
  the fact-checks written about it.
- Evidence is ranked by specificity: the named organisation is the floor, not the
  answer, so an RBI story about a wallet licence is not evidence about ₹500 notes.
- Analysts receive today's date, the age of the newest source and how many items
  come from the last week, and are told to be decisive when several publishers
  report the same event.
- No keyed model answering no longer produces a fake negative finding. The reply
  says the models were unavailable and cites the freshest headlines; the verdict
  chip reads "No verdict yet" instead of "unverified".
- Every source carries its publication date, and the answer ends in a sources box
  (count, publishers, "Newest: 2h ago · 23 this week") with an explicit warning
  when nothing was retrieved.
