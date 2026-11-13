import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PolicyProse } from "@/components/pages/PageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Jan Drishti collects, why, how long it is kept, and what we never do with reader data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageShell
      kicker="Legal"
      title="Privacy policy"
      lede="We collect as little as possible, keep it for as short as possible, and never sell it."
      updated="Version 1.0"
    >
      <PolicyProse>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Submissions.</strong> The claim text, optional link, optional screenshot, optional name and
            optional email address you provide, plus a one-way hash of your IP address for abuse prevention.
          </li>
          <li>
            <strong>Accounts.</strong> If you sign in, we store your email address, display name and role. Passwords
            are handled by Firebase Authentication and are never stored by our application.
          </li>
          <li>
            <strong>Bookmarks.</strong> The stories you save, linked to your account.
          </li>
          <li>
            <strong>Newsletter.</strong> Your email address only.
          </li>
          <li>
            <strong>Server logs.</strong> Standard request metadata retained by our hosting provider for security
            and reliability.
          </li>
        </ul>

        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell or rent reader data.</li>
          <li>We do not run third-party advertising trackers.</li>
          <li>We do not publish submitter identities without explicit consent.</li>
          <li>We do not send editorial marketing to newsletter subscribers.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          Submissions are retained while a claim is under review and for up to 24 months afterwards for
          accountability and audit purposes. Account data is retained until you delete your account. Newsletter
          addresses are removed on unsubscribe.
        </p>

        <h2>Who can see submissions</h2>
        <p>
          Only accounts with a researcher, editor or admin role. Access is enforced server-side and every
          editorial read or write of a review file is written to an audit log.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask for a copy of what we hold about you, ask us to correct it, or ask us to delete it. Email{" "}
          <Link href="/contact">the desk</Link> and we will respond within 30 days. Where a legal obligation or an
          active investigation prevents deletion, we will tell you why.
        </p>

        <h2>Processors</h2>
        <p>
          We use Firebase (Google) for authentication, database and file storage, and Vercel for hosting. Where an
          AI or search provider is configured for research assistance, submitted claim text may be processed by that
          provider solely to retrieve evidence and draft a preliminary report. The current configuration status is
          published on the <Link href="/fact-checking-methodology">methodology page</Link>.
        </p>

        <h2>Children</h2>
        <p>
          Jan Drishti is a news service intended for general readers. We do not knowingly collect personal
          information from children under 13.
        </p>

        <h2>Changes</h2>
        <p>
          Material changes to this policy will be dated on this page. Because we log our own mistakes, the history
          of this policy is available on request.
        </p>
      </PolicyProse>
    </PageShell>
  );
}
