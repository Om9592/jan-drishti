import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PolicyProse } from "@/components/pages/PageShell";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms on which Jan Drishti publishes reporting, fact checks and reader submissions.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell
      kicker="Legal"
      title="Terms of use"
      lede="Short, because the interesting rules are editorial ones — and those are published in full."
      updated="Version 1.0"
    >
      <PolicyProse>
        <h2>Reading</h2>
        <p>
          Jan Drishti is free to read. Reporting may be quoted with attribution and a link. Republishing whole
          articles requires permission; write to <Link href="/contact">the desk</Link>.
        </p>

        <h2>Fact checks are findings, not legal judgments</h2>
        <p>
          A verdict describes what the available evidence shows at the date of verification. It is not a court
          ruling, not a determination of intent, and not a substitute for legal advice. Verdicts may be revised if
          new evidence emerges; every revision is logged on the <Link href="/corrections">corrections page</Link>.
        </p>

        <h2>Submissions</h2>
        <p>
          By submitting a claim, tip or correction you confirm the material is yours to share and that you consent
          to its publication in edited form. Do not submit material you know to be false, or that you are legally
          prohibited from sharing. You retain ownership of your own words; you grant us a licence to publish and
          archive them.
        </p>

        <h2>Accounts</h2>
        <p>
          Accounts are for readers and editorial staff. Editorial permissions are granted only by an administrator
          and are enforced server-side. Attempting to access editorial tools without authorisation is prohibited and
          logged.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not scrape the site at a rate that degrades service for others.</li>
          <li>Do not attempt to access unpublished drafts, review files or other readers&rsquo; data.</li>
          <li>Do not use our name or marks to imply endorsement.</li>
        </ul>

        <h2>Availability and liability</h2>
        <p>
          The service is provided as-is. We aim for accuracy and availability but do not warrant either. To the
          extent permitted by law, we are not liable for indirect losses arising from use of the site. Nothing here
          limits rights you have under applicable consumer law.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of India, with courts in New Delhi having jurisdiction. Complaints are
          better handled by <Link href="/submit?type=correction">telling us first</Link>.
        </p>
      </PolicyProse>
    </PageShell>
  );
}
