import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PolicyProse } from "@/components/pages/PageShell";

export const metadata: Metadata = {
  title: "Funding Transparency",
  description:
    "Who funds Jan Drishti, what we refuse, and how editorial decisions stay independent of revenue.",
  alternates: { canonical: "/funding" },
};

export default function FundingPage() {
  return (
    <PageShell
      kicker="Transparency"
      title="Who pays for this newsroom"
      lede="Independence is a funding question before it is an editorial one. Here is our position, stated plainly."
      updated="Disclosure reviewed annually"
      aside={{
        title: "Related",
        links: [
          { href: "/editorial-policy", label: "Editorial policy" },
          { href: "/about", label: "About the newsroom" },
          { href: "/contact", label: "Contact" },
        ],
      }}
    >
      <PolicyProse>
        <h2>What we accept</h2>
        <ul>
          <li>
            <strong>Reader contributions.</strong> Voluntary payments from individuals. No donor receives editorial
            influence, early access, or coverage commitments.
          </li>
          <li>
            <strong>Institutional grants</strong> from foundations that publish their own grant-making and accept
            that grantees retain full editorial control. Grants above a threshold are disclosed individually.
          </li>
          <li>
            <strong>Syndication fees</strong> for republishing our work, where the terms do not restrict what we
            report.
          </li>
        </ul>

        <h2>What we refuse</h2>
        <ul>
          <li>Money from political parties, elected representatives or their affiliated bodies.</li>
          <li>Government advertising or paid content programmes.</li>
          <li>Sponsored articles, “branded news”, or any arrangement where a funder reviews copy.</li>
          <li>Donations conditional on coverage, tone or a particular editorial position.</li>
        </ul>

        <h2>How we handle conflicts</h2>
        <p>
          Staff declare financial interests, board roles and political affiliations annually and on new
          assignments. A journalist with a direct interest in a story does not report it. Where a declared interest
          touches a published piece, it is disclosed at the foot of that article.
        </p>

        <h2>Current disclosure status</h2>
        <div className="not-prose border border-rule bg-paper p-4">
          <p className="font-sans text-[0.84rem] leading-relaxed text-ink-soft">
            This deployment of Jan Drishti is an editorial platform build. No revenue has been received, no grants
            have been accepted, and no commercial agreements exist. When funding begins, each source will be listed
            here with its amount band, purpose and any conditions attached — before it is relied upon.
          </p>
          <p className="mt-2 font-sans text-[0.8rem] leading-relaxed text-ink-muted">
            If you believe a funder has influenced our coverage, tell us at{" "}
            <Link href="/contact" className="text-navy underline decoration-gold underline-offset-2">
              contact
            </Link>{" "}
            and we will investigate and publish the finding.
          </p>
        </div>

        <h2>Editorial firewall</h2>
        <p>
          Revenue decisions sit with the trust; editorial decisions sit with the editor. No commercial staff member
          has access to unpublished reporting, and no publishing permission in our system is granted to a
          non-editorial role. This is enforced in software, not only in policy: only accounts with an editor or
          admin role can publish, and every publishing action is written to an audit log.
        </p>
      </PolicyProse>
    </PageShell>
  );
}
