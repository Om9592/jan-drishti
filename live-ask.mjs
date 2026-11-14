const SITE = process.env.SITE ?? "https://jan-drishti-navy.vercel.app";
const claim =
  process.env.CLAIM ??
  "The Election Commission of India has announced that the Delhi Assembly election will be held in February 2027.";

async function main() {
  const caps = await fetch(`${SITE}/api/fact-check/ask`).then((r) => r.json());
  console.log("capabilities:", JSON.stringify(caps));

  const t0 = Date.now();
  const res = await fetch(`${SITE}/api/fact-check/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim, language: "en" }),
  });
  const json = await res.json();
  console.log(`POST /api/fact-check/ask -> ${res.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (!res.ok) {
    console.log(JSON.stringify(json).slice(0, 600));
    return;
  }
  const a = json.answer;
  console.log("id:", a.id, "| machine:", a.machine);
  console.log("verdict:", a.verdict, "|", a.confidence, "| publishers:", a.publishers, "| evidence:", a.evidenceChecked);
  console.log("headline:", a.headline.slice(0, 130));
  console.log("sources:", a.sources.length, "->", a.sources.map((s) => s.publisher).join(", "));
  console.log("analysts:", a.analysts.map((x) => `${x.provider}/${x.model}=${x.verdict}${x.agrees ? "" : "!"}`).join(" | "));
  console.log("recheck:", a.reCheck);
  console.log("flags:", a.flags.join(", ") || "none");
console.log("recorded for the desk:", a.recorded);

  // The machine answer must never appear in the human-signed archive.
  const listing = await fetch(`${SITE}/fact-check`).then((r) => r.text());
  console.log("\nclaim text in public archive:", listing.includes(a.headline.slice(0, 40)));

  const desk = await fetch(`${SITE}/admin/ai-checks`);
  const deskHtml = await desk.text();
  const visible = deskHtml
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\"/g, '"');
  console.log(
    "/admin/ai-checks without a session ->",
    desk.status,
    "| says no access:", /do not have editorial access/i.test(visible),
    "| report in the payload:", deskHtml.includes("AI answers given to the public"),
    "| claim leaked:", deskHtml.includes(claim.slice(20, 60)),
  );

  const page = await fetch(`${SITE}/fact-check`).then((r) => r.text());
  console.log("/fact-check has the ask box:", page.includes("Check it now"));
}
main();
