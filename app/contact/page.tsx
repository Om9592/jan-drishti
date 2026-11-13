import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageSquareWarning, ShieldAlert, Megaphone } from "lucide-react";
import { PageShell } from "@/components/pages/PageShell";
import { SubmissionForm } from "@/components/factcheck/SubmissionForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact the Jan Drishti desk: reporting tips, fact-check submissions, corrections, press and partnership enquiries.",
  alternates: { canonical: "/contact" },
};

const CHANNELS = [
  {
    icon: MessageSquareWarning,
    title: "Claims and fact checks",
    body: "The fastest route for a viral claim, screenshot or link.",
    action: { href: "/submit", label: "Use the verification form" },
  },
  {
    icon: ShieldAlert,
    title: "Corrections and complaints",
    body: "Tell us exactly what is wrong and link the passage. We answer within 24 hours where possible.",
    action: { href: "/submit?type=correction", label: "Request a correction" },
  },
  {
    icon: Megaphone,
    title: "Press and syndication",
    body: "Republishing enquiries, interviews and newsroom partnerships.",
    action: { href: "mailto:desk@jandrishti.example", label: "desk@jandrishti.example" },
  },
  {
    icon: Mail,
    title: "Everything else",
    body: "Funding questions, data requests and reader feedback.",
    action: { href: "mailto:contact@jandrishti.example", label: "contact@jandrishti.example" },
  },
];

export default function ContactPage() {
  return (
    <PageShell
      kicker="Contact"
      title="Talk to the desk"
      lede="A newsroom without a front door is a broadcast. Here is how to reach a person."
      aside={{
        title: "Before you write",
        links: [
          { href: "/fact-checking-methodology", label: "How we check a claim" },
          { href: "/corrections", label: "Corrections log" },
          { href: "/editorial-policy", label: "Editorial policy" },
        ],
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CHANNELS.map(({ icon: Icon, title, body, action }) => (
          <div key={title} className="border border-rule bg-white p-4">
            <Icon className="h-4 w-4 text-gold-dark" aria-hidden="true" />
            <h2 className="mt-2 font-serif text-[1.05rem] text-navy">{title}</h2>
            <p className="mt-1 font-sans text-[0.8rem] leading-relaxed text-ink-muted">{body}</p>
            <a
              href={action.href}
              className="mt-2.5 inline-block border-b border-gold pb-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
            >
              {action.label}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-9 border-t border-rule pt-6">
        <h2 className="font-serif text-[1.25rem] text-navy">Send a message to the desk</h2>
        <p className="mt-1 font-sans text-[0.82rem] leading-relaxed text-ink-muted">
          This form reaches the editorial team. For a claim you want verified, the{" "}
          <Link href="/submit" className="text-navy underline decoration-gold underline-offset-2">
            verification form
          </Link>{" "}
          routes it directly into the review queue.
        </p>
        <div className="mt-4">
          <SubmissionForm type="news_tip" />
        </div>
      </div>

      <div className="mt-8 border-t border-rule pt-4 font-sans text-[0.75rem] leading-relaxed text-ink-muted">
        <p>
          Jan Drishti Media Trust (registered public trust) · New Delhi, India. Published in English and Hindi.
        </p>
        <p className="mt-1">
          Encrypted tip-off? Ask for our Signal number in your first email — we will confirm it from a published
          address before you send anything sensitive.
        </p>
      </div>
    </PageShell>
  );
}
