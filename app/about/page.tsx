import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PolicyProse } from "@/components/pages/PageShell";

export const metadata: Metadata = {
  title: "About Jan Drishti",
  description:
    "Jan Drishti is an independent Indian journalism and fact-checking platform. Who we are, how we are funded, and what we will not do.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PageShell
      kicker="The newsroom"
      title="An Indian newsroom built around evidence, not volume"
      lede="Jan Drishti publishes reporting and fact checks for readers who want to know what actually happened — and what could not be established."
      updated="Editorial charter · version 1.0"
      aside={{
        title: "Standards",
        links: [
          { href: "/editorial-policy", label: "Editorial policy" },
          { href: "/fact-checking-methodology", label: "Fact-checking methodology" },
          { href: "/corrections", label: "Corrections log" },
          { href: "/funding", label: "Funding transparency" },
          { href: "/contact", label: "Contact the desk" },
        ],
      }}
    >
      <PolicyProse>
        <p>
          Jan Drishti (<span lang="hi">जन दृष्टि</span>, “the public view”) is an independent digital publication
          covering Indian public life and verifying the claims that circulate around it. We publish in English and
          Hindi, and we treat both editions as reporting rather than translation.
        </p>

        <h2>What we are trying to do</h2>
        <p>
          Indian readers do not lack information. They lack ways to tell which information is load-bearing. Our
          work is organised around three questions: what happened, what does the record actually say, and what
          remains unknown. That third question is the one most newsrooms skip, and it is the one readers need most.
        </p>

        <h2>What we will not do</h2>
        <ul>
          <li>We will not carry paid political narratives, sponsored policy content, or “branded” news.</li>
          <li>We will not publish a claim we cannot trace to a source a reader can open.</li>
          <li>We will not publish a fact-check verdict written by a machine. Every verdict is signed by a person.</li>
          <li>We will not delete a correction. We log it, date it and leave it visible.</li>
          <li>We will not describe ourselves as unbiased. Bias is a claim about a mind; fairness is a practice.</li>
        </ul>

        <h2>How fairness is demonstrated, not declared</h2>
        <p>
          We publish our <Link href="/editorial-policy">editorial policy</Link>, our{" "}
          <Link href="/fact-checking-methodology">fact-checking methodology</Link>, our{" "}
          <Link href="/corrections">corrections log</Link> and our{" "}
          <Link href="/funding">funding sources</Link>. Each fact-check report shows supporting evidence and
          contradicting evidence side by side, names the reviewer, and states the confidence level. If a reader
          thinks a verdict is wrong, they can challenge it and the outcome is published.
        </p>

        <h2>Who works here</h2>
        <p>
          The desk is organised in four roles: reporters and editors who commission and publish; researchers who
          build evidence files; a review editor who signs verdicts; and an independence officer responsible for
          funding disclosure and conflict-of-interest declarations. Role permissions are enforced in the
          application, not just in policy: only accounts with an editor or admin role can publish, and every
          editorial action is written to an audit log.
        </p>

        <h2>How we use artificial intelligence</h2>
        <p>
          AI is a research assistant here, not a byline. It helps extract claims from a forwarded message,
          generate search queries, classify sources and summarise retrieved evidence. It cannot publish. Machine
          output is labelled “preliminary” everywhere in our system, and a named human editor must review every
          evidence item before a verdict appears on this site. When no AI provider is configured, the platform
          says so on the page rather than pretending a search took place.
        </p>

        <h2>What we publish today</h2>
        <p>
          Reporting types are labelled on every story: <strong>original reporting</strong>,{" "}
          <strong>news summary</strong>, <strong>reporting from another publisher</strong>,{" "}
          <strong>opinion and analysis</strong>, and <strong>explainer</strong>. We never present another
          publisher&apos;s work as ours.
        </p>

        <h2>Getting in touch</h2>
        <p>
          Tips, claims and corrections: use the <Link href="/submit">submission form</Link>. Editorial and
          partnership enquiries: see <Link href="/contact">contact</Link>. We read everything; we cannot always
          reply individually.
        </p>
      </PolicyProse>
    </PageShell>
  );
}
