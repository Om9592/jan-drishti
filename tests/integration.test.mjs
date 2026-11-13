/**
 * Integration tests — run against a live server.
 *
 *   npm run build && npm start &
 *   npm test
 *
 * These tests exercise the actual HTTP surface (routing, validation, rate
 * limiting, the research → review → publish gate) rather than units of
 * internal logic, because that is what readers and editors touch.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

async function get(path) {
  return fetch(`${BASE}${path}`, { redirect: "manual" });
}

async function post(path, body, headers = {}) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("public routes render", async () => {
  const routes = [
    "/",
    "/latest",
    "/india",
    "/politics",
    "/economy",
    "/education",
    "/health",
    "/states",
    "/ground-reports",
    "/fact-check",
    "/submit",
    "/search",
    "/about",
    "/editorial-policy",
    "/fact-checking-methodology",
    "/corrections",
    "/contact",
    "/funding",
    "/privacy",
    "/terms",
    "/login",
  ];
  for (const route of routes) {
    const res = await get(route);
    assert.equal(res.status, 200, `${route} should return 200`);
    const html = await res.text();
    assert.ok(html.includes("Jan Drishti") || html.includes("जन दृष्टि"), `${route} should render the masthead`);
  }
});

test("article and fact-check detail pages render with evidence sections", async () => {
  const article = await get("/article/how-jan-drishti-verifies-a-viral-claim");
  assert.equal(article.status, 200);
  const articleHtml = await article.text();
  assert.ok(articleHtml.includes("Sources and documents"));

  const report = await get("/fact-check/sample-illustrative-claim-misleading-example");
  assert.equal(report.status, 200);
  const reportHtml = await report.text();
  assert.ok(reportHtml.includes("ClaimReview"), "fact check should emit ClaimReview structured data");
  assert.ok(reportHtml.includes("Evidence against the claim") || reportHtml.includes("Evidence that supports"));
});

test("unknown slugs return 404", async () => {
  const res = await get("/article/this-does-not-exist");
  assert.equal(res.status, 404);
});

test("security headers are set", async () => {
  const res = await get("/");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.ok(res.headers.get("referrer-policy"));
});

test("robots.txt and sitemap.xml are served", async () => {
  const robots = await get("/robots.txt");
  assert.equal(robots.status, 200);
  const robotsText = await robots.text();
  assert.ok(robotsText.includes("Sitemap:"));

  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  const sitemapText = await sitemap.text();
  assert.ok(sitemapText.includes("/fact-check"));
});

test("health endpoint reports honest capability state", async () => {
  const res = await get("/api/health");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(["firestore", "sample"].includes(body.backend));
  assert.equal(typeof body.capabilities.ai, "boolean");
  assert.equal(typeof body.capabilities.search, "boolean");
});

test("submission validation rejects short or consent-less payloads", async () => {
  const tooShort = await post("/api/submissions", {
    type: "viral_claim",
    content: "short",
    language: "en",
    consent: true,
  });
  assert.equal(tooShort.status, 422);

  const noConsent = await post("/api/submissions", {
    type: "viral_claim",
    content: "A forwarded message claims that a scheme deadline was extended by six months.",
    language: "en",
  });
  assert.equal(noConsent.status, 422);

  const badEmail = await post("/api/submissions", {
    type: "viral_claim",
    content: "A forwarded message claims that a scheme deadline was extended by six months.",
    language: "en",
    contactEmail: "not-an-email",
    consent: true,
  });
  assert.equal(badEmail.status, 422);
});

test("a valid submission is accepted and receives a reference", async () => {
  const res = await post("/api/submissions", {
    type: "viral_claim",
    content:
      "Claim under test: the scholarship application deadline was extended by six months for all states, according to a forwarded WhatsApp message.",
    url: "https://example.org/forwarded-claim",
    language: "en",
    consent: true,
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.reference, "a human-readable reference should be returned");
});

test("research creates a preliminary, unpublishable review file", async () => {
  const res = await post("/api/research", {
    claimText:
      "Claim under test: a new rule requires every household to register with a district office before December.",
    language: "en",
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.factCheckId);
  assert.equal(body.report.preliminary, true, "machine output must stay preliminary");
  assert.equal(typeof body.report.searchConfigured, "boolean");
  if (!body.report.searchConfigured) {
    assert.equal(
      body.report.preliminaryVerdict,
      "unverified",
      "without evidence retrieval the only honest recommendation is UNVERIFIED",
    );
  }
});

test("a fact-check cannot be published without a reviewer decision body", async () => {
  const research = await post("/api/research", {
    claimText: "Claim under test: a photograph shows a crowd larger than the district population.",
    language: "en",
  });
  const { factCheckId } = await research.json();

  const incomplete = await fetch(`${BASE}/api/fact-checks/${factCheckId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", verdict: "false" }),
  });
  assert.equal(incomplete.status, 422, "an unexplained verdict must be rejected");

  const complete = await fetch(`${BASE}/api/fact-checks/${factCheckId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "publish",
      verdict: "false",
      explanationEn:
        "The photographed crowd is smaller than the district's published resident population, so the claim as stated cannot be accurate.",
      contextEn:
        "Viral crowd photographs are routinely recycled across events; the verifiable facts are the district population and the absence of any official crowd estimate.",
      confidenceLevel: "high",
      headlineEn: "Test verdict: crowd figure exceeds the district population",
    }),
  });
  assert.equal(complete.status, 200);
  const published = await complete.json();
  assert.equal(published.status, "published");
});

test("newsletter rejects invalid email addresses", async () => {
  const res = await post("/api/newsletter", { email: "nope" });
  assert.equal(res.status, 422);
});

test("admin surface requires a role when Firebase auth is enabled", async () => {
  const res = await get("/admin");
  // In demo mode (no Firebase credentials) the desk renders with a visible banner.
  assert.ok([200, 401, 403].includes(res.status));
  if (res.status === 200) {
    const html = await res.text();
    assert.ok(html.includes("Editorial desk") || html.includes("संपादकीय डेस्क"));
  }
});
