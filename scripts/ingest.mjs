#!/usr/bin/env node
/**
 * Triggers news ingestion.
 *
 *   node scripts/ingest.mjs                       # against SITE_URL
 *   node scripts/ingest.mjs --url http://localhost:3000
 *
 * Requires CRON_SECRET (same value as the deployment). The endpoint only
 * ingests sources that an editor has explicitly enabled, and respects
 * robots.txt. Ingested items are filed as `review`, never published.
 */
const args = process.argv.slice(2);
const urlIndex = args.indexOf("--url");

async function main() {
  const site =
    (urlIndex > -1 ? args[urlIndex + 1] : undefined) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000";
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("CRON_SECRET is not set. Export it or add it to .env.local (then source the file).");
    process.exit(1);
  }

  const endpoint = `${site.replace(/\/$/, "")}/api/cron/ingest`;
  console.log(`→ ${endpoint}`);

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`Ingestion failed (${response.status}):`, body.error ?? response.statusText);
    process.exit(1);
  }

  for (const result of body.results ?? []) {
    console.log(
      `· ${result.sourceName}: ${result.status} — fetched ${result.fetched}, created ${result.created}, duplicates ${result.duplicates}${result.message ? ` (${result.message})` : ""}`,
    );
  }
  if (!body.results?.length) console.log("No enabled sources. Enable a feed in the editorial desk first.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
