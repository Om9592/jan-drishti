import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PolicyProse } from "@/components/pages/PageShell";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { VERDICT_META } from "@/lib/utils";
import type { Verdict } from "@/lib/types";
import { capabilities } from "@/lib/config";

export const metadata: Metadata = {
  title: "Fact-Checking Methodology",
  description:
    "How Jan Drishti verifies a viral claim: claim extraction, evidence retrieval, source classification, verdict definitions, confidence levels and the human approval gate.",
  alternates: { canonical: "/fact-checking-methodology" },
};

export default function MethodologyPage() {
  const caps = capabilities();

  return (
    <PageShell
      kicker="Method"
      title="How we check a claim"
      lede="A verifiable process, a published evidence file, and a named editor who signs the verdict."
      updated="Version 1.0 · reviewed quarterly"
      aside={{
        title: "On this page",
        links: [
          { href: "#pipeline", label: "The eleven-step pipeline" },
          { href: "#sources", label: "Source hierarchy" },
          { href: "#verdicts", label: "Verdict definitions" },
          { href: "#confidence", label: "Confidence levels" },
          { href: "#limits", label: "Limits and disclosures" },
          { href: "/editorial-policy", label: "Editorial policy" },
        ],
      }}
    >
      <PolicyProse>
        <h2 id="pipeline">The pipeline</h2>
        <p>
          Every claim passes through the same sequence. Steps are logged, so an editor can see exactly what was
          done, and a reader can see exactly what was found.
        </p>
        <ol>
          <li>
            <strong>Record the claim verbatim.</strong> Forwarded text is captured exactly as received, including
            spelling errors; screenshots are transcribed and the extracted text is stored alongside the image.
          </li>
          <li>
            <strong>Extract checkable claims.</strong> A single forward often contains several factual statements
            plus opinion. We list each checkable claim separately and mark opinion and prediction as such.
          </li>
          <li>
            <strong>Identify entities.</strong> Named people, offices, places, dates and document numbers become the
            anchors for searching public records.
          </li>
          <li>
            <strong>Generate research queries.</strong> Queries are written to find primary documents first —
            notifications, orders, releases, datasets — and independent reporting second.
          </li>
          <li>
            <strong>Retrieve evidence.</strong> Searches run against configured providers. If no provider is
            configured, the file records that the evidence step could not be performed and no verdict is
            recommended beyond UNVERIFIED.
          </li>
          <li>
            <strong>Classify sources.</strong> Each item is tagged as a government statement, primary record,
            independent journalism, research publication, opinion, or social media claim. These tags appear in the
            published report.
          </li>
          <li>
            <strong>Compare both directions.</strong> Researchers assemble supporting evidence and then spend equal
            effort finding contradicting evidence. Both lists are published.
          </li>
          <li>
            <strong>Name the missing context.</strong> &ldquo;Missing context&rdquo; is a required field: an
            outdated photograph, a state scheme described as national, a quote trimmed to change its meaning.
          </li>
          <li>
            <strong>Draft a preliminary report.</strong> AI may draft summaries and recommend a verdict. That
            recommendation is stored as preliminary and is visibly labelled as such.
          </li>
          <li>
            <strong>Editorial review.</strong> An editor with the required role checks every evidence item, rewrites
            the explanation, and may reject the file outright.
          </li>
          <li>
            <strong>Publish, with accountability.</strong> The verdict goes live with the reviewer&rsquo;s name, the
            verification date, the confidence level and a challenge route for readers.
          </li>
        </ol>

        <h2 id="sources">Source hierarchy</h2>
        <p>Not all sources carry equal weight. We rank them explicitly rather than averaging them into mush.</p>
        <ul>
          <li>
            <strong>Tier 1 — primary records:</strong> gazette notifications, statutes, court orders, official
            datasets, audited accounts, tender documents, parliamentary answers.
          </li>
          <li>
            <strong>Tier 2 — institutional statements:</strong> official press releases and named spokespersons.
            These establish what an institution says, not necessarily what is true.
          </li>
          <li>
            <strong>Tier 3 — independent journalism:</strong> reporting by newsrooms with published corrections
            policies, especially where a reporter spoke to primary sources directly.
          </li>
          <li>
            <strong>Tier 4 — research:</strong> peer-reviewed work, working papers and reputable survey data, with
            attention to sample size and funding.
          </li>
          <li>
            <strong>Tier 5 — claims under review:</strong> social media posts, anonymous messaging and forwarded
            content. These are the object of verification, never the basis for a verdict.
          </li>
        </ul>
        <p>
          A Tier 1 document can settle a factual question on its own. A Tier 5 item can never do so, whatever its
          reach.
        </p>

        <h2 id="verdicts">Verdict definitions</h2>
        <div className="not-prose space-y-3">
          {(Object.keys(VERDICT_META) as Verdict[]).map((verdict) => (
            <div key={verdict} className="flex flex-col gap-1.5 border-l border-rule pl-3 sm:flex-row sm:items-baseline sm:gap-3">
              <div className="w-36 shrink-0">
                <VerdictBadge verdict={verdict} size="sm" />
              </div>
              <p className="font-sans text-[0.85rem] leading-relaxed text-ink-soft">
                {VERDICT_META[verdict].description}
              </p>
            </div>
          ))}
        </div>

        <h2 id="confidence">Confidence levels</h2>
        <ul>
          <li>
            <strong>High:</strong> a primary document or multiple independent records settle the question directly.
          </li>
          <li>
            <strong>Medium:</strong> the weight of evidence points one way, but a relevant record is missing or
            indirect.
          </li>
          <li>
            <strong>Low:</strong> the available material is thin, contested or tangential. Low confidence usually
            accompanies UNVERIFIED or DISPUTED.
          </li>
        </ul>

        <h2 id="limits">Limits and disclosures</h2>
        <p>
          A fact check can only address the claim as stated. It does not adjudicate motive, and it does not
          substitute for a court. We do not check claims about private individuals&rsquo; personal lives unless
          there is a clear public interest, and we do not amplify a claim that is dangerous to repeat.
        </p>
        <p>
          Our verification work depends on access to documents. Where a record is not public — classified material,
          sealed filings, private messages — we say the question is unanswerable rather than implying it has been
          answered.
        </p>

        <h2>Current configuration of this deployment</h2>
        <ul>
          <li>
            <strong>Evidence retrieval:</strong>{" "}
            live. Every claim run searches Google News, Bing News, our own trusted wire of Indian publishers and
            Wikipedia, and de-duplicates against syndicated copies.{" "}
            {caps.search
              ? "A paid search provider is also configured and adds a fourth index."
              : "No paid search provider is configured; the keyless retrievers carry the whole evidence step, so nothing is simulated."}
          </li>
          <li>
            <strong>AI research assistance:</strong>{" "}
            {caps.ai
              ? "configured — the model extracts claims, cross-checks the retrieved sources and recommends a verdict in a single run that takes seconds, but the verdict remains human-issued."
              : "the pipeline is built and runs, but no model key is installed on this deployment, so no AI synthesis happens — the desk gets the evidence file and writes the finding itself."}{" "}
            A machine recommendation is never published: an editor signs every verdict, and a verdict of true or false
            is blocked unless at least three independent publishers — or one primary government or court record —
            support it.
          </li>
          <li>
            <strong>Screenshot OCR:</strong>{" "}
            {caps.ocr ? "configured." : "not configured — screenshots are transcribed by hand."}
          </li>
          <li>
            <strong>Database:</strong>{" "}
            {caps.database === "firestore" ? "Firestore." : "sample store — this preview is not publishing live verdicts."}
          </li>
        </ul>

        <p>
          Our editorial standards, including how we handle challenges to a verdict, are set out in the{" "}
          <Link href="/editorial-policy">editorial policy</Link>. If you want to challenge a published finding, use
          the <Link href="/submit?type=correction">correction and challenge form</Link>.
        </p>
      </PolicyProse>
    </PageShell>
  );
}
