import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, BadgeCheck, FileText, LayoutDashboard, PenLine, ShieldCheck } from "lucide-react";
import { ContributorApplicationForm } from "@/components/contributor/ContributorApplicationForm";
import { getViewer } from "@/lib/security/auth";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Write for Jan Drishti — freelance contributors",
  description:
    "Freelance journalists and editors can pitch Jan Drishti, file stories from their own desk, and get paid work published after editorial review.",
  alternates: { canonical: "/contribute" },
};

const STEPS = [
  {
    icon: PenLine,
    title: "Pitch the beat",
    body: "Tell us what you cover and the story you want to report. One paragraph of specifics beats a résumé.",
  },
  {
    icon: BadgeCheck,
    title: "Get an invitation",
    body: "An editor reads every pitch. If it fits, you get a mail that lets you set your own password — we never ask for one.",
  },
  {
    icon: FileText,
    title: "File from your desk",
    body: "Your dashboard holds your drafts, submissions and the editor's notes. Word count, section, sources, image — all in one form.",
  },
  {
    icon: ShieldCheck,
    title: "Reviewed, then published",
    body: "Nothing goes live on its own. A named editor checks sourcing and legal risk, then approves. Only then does it carry your byline.",
  },
];

export default async function ContributePage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const viewer = await getViewer();
  const isContributor = viewer?.role === "contributor";
  const isStaff = viewer?.role === "editor" || viewer?.role === "admin";

  return (
    <div className="container-editorial py-9">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gold" aria-hidden="true" />
            <p className="kicker-gold">Freelance desk</p>
          </div>
          <h1 className="mt-2 font-serif text-[2rem] leading-tight text-navy sm:text-[2.4rem]">
            Write for Jan Drishti from wherever you are
          </h1>
          <p className="mt-3 max-w-xl font-sans text-[0.92rem] leading-relaxed text-ink-soft">
            India&apos;s most important stories are filed from district courts, primary health centres and municipal
            offices — not from a metro newsroom. If you report from there, you should be able to publish there.
          </p>

          <div className="mt-6 space-y-4">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-rule bg-white">
                  <step.icon className="h-4 w-4 text-navy" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-muted">
                    Step {index + 1}
                  </p>
                  <h2 className="font-serif text-[1.05rem] font-semibold text-navy">{step.title}</h2>
                  <p className="mt-0.5 font-sans text-[0.82rem] leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 border-l-2 border-gold bg-paper-shade p-4">
            <p className="font-sans text-[0.8rem] font-medium text-ink">The rule that does not bend</p>
            <p className="mt-1 font-sans text-[0.8rem] leading-relaxed text-ink-soft">
              Freelance copy is treated exactly like staff copy: an editor reads it, checks the sourcing and signs it
              off. There is no self-publishing path — not for anyone, including us. That is what makes the byline
              worth something.
            </p>
          </div>

          {isStaff && (
            <p className="mt-5 font-sans text-[0.8rem] text-ink-soft">
              You are signed in as {viewer?.role}.{" "}
              <Link href="/admin/contributors" className="underline decoration-rule underline-offset-2 hover:text-navy">
                Review contributor applications
              </Link>
              .
            </p>
          )}
          {isContributor && (
            <div className="mt-6 border border-navy/20 bg-white p-4">
              <p className="font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-muted">Already on the desk</p>
              <p className="mt-1 font-sans text-[0.85rem] text-ink-soft">
                Your drafts and editorial notes are waiting in your dashboard.
              </p>
              <Link href="/contribute/desk" className="btn-primary mt-3">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Open my desk
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          <div className="border border-rule bg-white p-5 sm:p-7">
            <h2 className="font-serif text-[1.35rem] font-semibold text-navy">Pitch the desk</h2>
            <p className="mt-1 font-sans text-[0.8rem] leading-relaxed text-ink-muted">
              No account needed. {t("submit.privacy")}
            </p>
            <div className="mt-5">
              <ContributorApplicationForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
