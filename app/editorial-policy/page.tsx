import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PolicyProse } from "@/components/pages/PageShell";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description:
    "Jan Drishti's editorial policy: independence, sourcing, separation of news and opinion, corrections, conflicts of interest and accountability.",
  alternates: { canonical: "/editorial-policy" },
};

export default function EditorialPolicyPage() {
  return (
    <PageShell
      kicker="Standards"
      title="Editorial policy"
      lede="The rules our newsroom works to — written so that readers can hold us to them."
      updated="Version 1.0 · applies to all Jan Drishti output"
      aside={{
        title: "On this page",
        links: [
          { href: "#independence", label: "Independence" },
          { href: "#sourcing", label: "Sourcing and attribution" },
          { href: "#news-opinion", label: "News versus opinion" },
          { href: "#ai", label: "AI and automation" },
          { href: "#corrections", label: "Corrections" },
          { href: "#conflicts", label: "Conflicts of interest" },
          { href: "/fact-checking-methodology", label: "Fact-checking methodology" },
        ],
      }}
    >
      <PolicyProse>
        <p>
          This policy governs everything published under the Jan Drishti name. It is a working document: when we
          change a rule we date the change and, where it affects published work, we note it in the{" "}
          <Link href="/corrections">corrections log</Link>.
        </p>

        <h2 id="independence">1. Independence</h2>
        <p>
          Jan Drishti takes no funding from political parties, elected representatives, government advertising
          programmes, or any entity whose interests we report on. Revenue comes from readers and, where applicable,
          from foundations that disclose grants publicly and exercise no editorial control. Every funding source is
          listed on our <Link href="/funding">funding transparency</Link> page.
        </p>
        <p>
          No advertiser sees editorial copy before publication. No sponsor may approve, edit or veto reporting.
          There is no “native” or “branded” content on this site.
        </p>

        <h2 id="sourcing">2. Sourcing and attribution</h2>
        <ul>
          <li>
            <strong>Primary documents first.</strong> Gazette notifications, court orders, budget documents,
            official data releases, tender notices and annual reports outrank summaries, briefings and social
            media posts.
          </li>
          <li>
            <strong>Named sources where possible.</strong> Anonymity is granted by an editor, not a reporter, and
            only where identification would expose a source to harm. The reader is told why anonymity was granted.
          </li>
          <li>
            <strong>Two-source rule for allegations.</strong> A claim that someone broke the law or acted in bad
            faith requires either a primary document or two independent sources. A single social media post is
            never sufficient.
          </li>
          <li>
            <strong>Every link works.</strong> If a source is removed after publication, we say so on the page
            rather than silently dropping the citation.
          </li>
          <li>
            <strong>Copyright.</strong> We do not reproduce other publishers&rsquo; articles. Summaries are short,
            attributed and link to the original. Quotations are limited to what is necessary for the story.
          </li>
        </ul>

        <h2 id="news-opinion">3. News versus opinion</h2>
        <p>
          Every article is labelled by type: original reporting, news summary, external-source reporting, opinion
          and analysis, or explainer. Opinion pieces are signed, carry the label at the top of the page, and are
          edited separately from news. Editorials represent the publication&rsquo;s view and are labelled as such.
          Opinion never appears inside a fact-check verdict.
        </p>

        <h2 id="ai">4. Artificial intelligence and automation</h2>
        <ul>
          <li>AI may assist research: claim extraction, query generation, source classification, summarisation.</li>
          <li>AI may never publish, and may never set a final verdict. Machine output is marked preliminary in the database and in the interface.</li>
          <li>Every published fact check names the human reviewer who approved it.</li>
          <li>Where an AI provider or search provider is not configured, the platform states that plainly. We never simulate a search or fabricate a source.</li>
          <li>Images generated or altered by AI are labelled wherever they appear. We do not use generated imagery to depict real events or identifiable people.</li>
        </ul>

        <h2 id="corrections">5. Corrections and clarifications</h2>
        <p>
          Material errors are corrected promptly and visibly, with a dated notice near the top of the affected
          story, a permanent entry in the <Link href="/corrections">corrections log</Link>, and a version bump.
          Typographical fixes that do not change meaning are made silently. Corrections are never deleted, and we
          do not unpublish stories to avoid correcting them — except where continued publication would endanger
          someone, in which case the removal itself is logged and explained.
        </p>
        <p>
          Anyone can request a correction through the <Link href="/submit?type=correction">correction form</Link>.
          You do not need an account, and you do not need to be the subject of the story. We aim to respond within
          24 hours.
        </p>

        <h2 id="conflicts">6. Conflicts of interest</h2>
        <p>
          Staff and regular contributors declare financial interests, family political affiliations, board
          memberships and ongoing litigation to the independence officer. Declarations are reviewed annually and
          whenever a new beat is assigned. A journalist with a direct interest in a story does not report it. Where
          a declared interest is relevant to a published piece, it is disclosed at the foot of the article.
        </p>

        <h2>7. Right of reply</h2>
        <p>
          Any person or organisation facing a significant criticism is given a reasonable opportunity to respond
          before publication, except where doing so would create a risk of harm or where the subject is already
          evading service. Their response, or their refusal to respond, is reported in the story.
        </p>

        <h2>8. Reader submissions</h2>
        <p>
          Submissions are treated as leads, not as evidence. A forwarded message is a claim to be tested, never a
          finding. Submitter identities are not published without explicit consent, and contact details are visible
          only to the editorial team.
        </p>

        <h2>9. Enforcement</h2>
        <p>
          Editorial policy is enforced through role-based access in the publishing system and through the audit log,
          which records who created, edited, reviewed and published every item. Repeated or serious breaches are
          handled by the review editor and, where warranted, disclosed publicly.
        </p>

        <h2>10. Challenging us</h2>
        <p>
          If you believe a piece of our reporting is wrong, unfair or unsupported, tell us through the{" "}
          <Link href="/submit?type=correction">correction form</Link>. If you believe a fact-check verdict is
          wrong, say so with evidence — we publish the outcome of that review, including when we were the ones at
          fault.
        </p>
      </PolicyProse>
    </PageShell>
  );
}
