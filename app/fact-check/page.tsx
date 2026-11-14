import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { FileSearch, ShieldCheck, Lock, Users } from "lucide-react";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { SubmissionForm } from "@/components/factcheck/SubmissionForm";
import { AskAiForm } from "@/components/factcheck/AskAiForm";
import { FactCheckCard } from "@/components/ui/FactCheckCard";
import { FilterBar } from "@/components/ui/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { VERDICT_META } from "@/lib/utils";
import { capabilities } from "@/lib/config";
import type { Verdict } from "@/lib/types";

export const metadata: Metadata = {
  title: "Fact Check — Before You Believe It, Verify It",
  description:
    "Submit a viral WhatsApp forward, screenshot or link. Jan Drishti traces it to primary records and publishes a human-approved verdict with the evidence attached.",
  alternates: { canonical: "/fact-check" },
  openGraph: {
    title: "Jan Drishti Fact Check — Before You Believe It, Verify It",
    description: "Forward it to us. We trace the claim to its evidence, then a named editor issues the verdict.",
    url: "/fact-check",
  },
};

export default async function FactCheckPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const caps = capabilities();

  const verdict = (typeof params.verdict === "string" ? params.verdict : "all") as Verdict | "all";
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const store = getStore();

  const [reports, queue, stats] = await Promise.all([
    store.listFactChecks({ status: "published", verdict, page, perPage: 8 }),
    store.listSubmissions("received"),
    store.getStats(),
  ]);

  const verdictOptions = [
    { value: "all", label: t("common.all") },
    ...(Object.keys(VERDICT_META) as Verdict[]).map((v) => ({ value: v, label: VERDICT_META[v][lang] })),
  ];

  return (
    <>
      {/* Hero + submission */}
      <section className="border-b border-rule bg-paper">
        <div className="container-editorial grid gap-10 py-10 lg:grid-cols-12 lg:gap-12 lg:py-14">
          <div className="lg:col-span-6">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold" aria-hidden="true" />
              <p className="kicker-gold">{lang === "hi" ? "वायरल न्यूज़ चेकर" : "Viral news checker"}</p>
            </div>

            <h1 className="mt-4 font-serif text-display-lg font-semibold leading-[1.05] text-navy">
              {t("factCheck.title")}
            </h1>
            <p className="mt-2 font-serif-hi text-[1.3rem] text-gold-dark" lang="hi">
              मानने से पहले, जाँचें।
            </p>

            <p className="mt-4 max-w-xl font-sans text-[0.95rem] leading-relaxed text-ink-soft">
              {t("factCheck.lede")}
            </p>

            <ol className="mt-7 space-y-3.5 border-t border-rule pt-5">
              {[t("factCheck.step1"), t("factCheck.step2"), t("factCheck.step3"), t("factCheck.step4")].map(
                (step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-navy/25 font-sans text-[0.6rem] text-navy">
                      {index + 1}
                    </span>
                    <span className="font-sans text-[0.85rem] leading-relaxed text-ink-soft">{step}</span>
                  </li>
                ),
              )}
            </ol>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
                <p className="font-sans text-[0.7rem] leading-relaxed text-ink-muted">
                  {lang === "hi"
                    ? "तुरंत मिलने वाला जवाब मशीन का है; पुरालेख में प्रकाशित निर्णय पर नामित संपादक के हस्ताक्षर होते हैं।"
                    : "The instant answer is machine output. Archived verdicts carry a named editor's signature."}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
                <p className="font-sans text-[0.7rem] leading-relaxed text-ink-muted">
                  {lang === "hi"
                    ? "सबमिशन की पहचान गोपनीय रहती है।"
                    : "Submitter identities are never published."}
                </p>
              </div>
            </div>

            <dl className="mt-7 grid grid-cols-3 divide-x divide-rule border-y border-rule py-3.5">
              <div className="pr-3">
                <dt className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                  {lang === "hi" ? "कतार में" : "In queue"}
                </dt>
                <dd className="mt-1 font-serif text-[1.35rem] text-navy">{queue.length}</dd>
              </div>
              <div className="px-3">
                <dt className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                  {lang === "hi" ? "प्रकाशित" : "Published"}
                </dt>
                <dd className="mt-1 font-serif text-[1.35rem] text-navy">{stats.publishedFactChecks}</dd>
              </div>
              <div className="pl-3">
                <dt className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                  {lang === "hi" ? "सुधार" : "Corrections"}
                </dt>
                <dd className="mt-1 font-serif text-[1.35rem] text-navy">{stats.corrections}</dd>
              </div>
            </dl>
          </div>

          <div className="lg:col-span-6">
            {/* Ask and get an answer here; the desk gets a copy either way. */}
            <AskAiForm />

            <div className="mt-6 border border-rule bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 border-b border-rule pb-3">
                <FileSearch className="h-4 w-4 text-gold-dark" aria-hidden="true" />
                <h2 className="font-serif text-[1.2rem] text-navy">{t("factCheck.formHeading")}</h2>
              </div>
              <p className="pt-3 font-sans text-[0.72rem] leading-relaxed text-ink-muted">
                {lang === "hi"
                  ? "अगर आप चाहते हैं कि हमारा संपादक खुद जाँच कर प्रकाशित निर्णय दे, तो दावा यहाँ भेजें — यह कतार में चला जाएगा।"
                  : "Want a named editor to verify it and publish a verdict? Send it here instead — it joins the editorial queue."}
              </p>
              <div className="pt-4">
                <SubmissionForm type="viral_claim" />
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 font-sans text-[0.68rem] leading-relaxed text-ink-muted">
              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {caps.ai
                ? lang === "hi"
                  ? "AI जाँच सक्रिय है। जवाब मशीन का है और हर जाँच का रिकॉर्ड संपादकीय डेस्क को जाता है।"
                  : "The AI checker is active. Its answer is labelled machine output, and every check is logged for the desk."
                : lang === "hi"
                  ? "AI शोध कॉन्फ़िगर नहीं है — शोधकर्ता मैन्युअल रूप से जाँचेंगे। कोई नक़ली निर्णय नहीं बनेगा।"
                  : "AI research is not configured — researchers will verify manually. No verdict is ever simulated."}
            </p>
          </div>
        </div>
      </section>

      {/* Verdict legend */}
      <section className="border-b border-rule bg-white">
        <div className="container-editorial py-7">
          <p className="kicker">{lang === "hi" ? "हमारे निर्णय" : "Our six verdicts"}</p>
          <ul className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(VERDICT_META) as Verdict[]).map((v) => (
              <li key={v} className="flex items-start gap-2.5">
                <VerdictBadge verdict={v} lang={lang} size="sm" withIcon={false} />
                <p className="font-sans text-[0.72rem] leading-relaxed text-ink-muted">
                  {VERDICT_META[v].description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reports */}
      <section className="container-editorial py-10">
        <SectionHeading
          title={t("factCheck.recent")}
          href="/fact-checking-methodology"
          linkLabel={t("footer.methodology")}
        />

        <div className="mt-4">
          <FilterBar
            label={t("common.verdict")}
            options={verdictOptions}
            active={verdict}
            buildHref={(value) => (value === "all" ? "/fact-check" : `/fact-check?verdict=${value}`)}
          />
        </div>

        {reports.items.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={t("empty.factChecks")}
            body={t("empty.factChecksBody")}
            action={{ href: "/submit", label: t("factCheck.form.submit") }}
          />
        ) : (
          <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {reports.items.map((fc) => (
              <FactCheckCard key={fc.id} factCheck={fc} lang={lang} />
            ))}
          </div>
        )}

        <div className="mt-10 grid gap-6 border-t border-rule pt-6 lg:grid-cols-2">
          <div>
            <p className="kicker-gold">{t("factCheck.standards")}</p>
            <ul className="mt-2 space-y-2 font-sans text-[0.82rem] leading-relaxed text-ink-soft">
              <li>
                · {lang === "hi"
                  ? "प्रत्येक रिपोर्ट में मूल दावा, प्रमाण, स्रोत-लिंक और तिथियाँ होती हैं।"
                  : "Every report carries the original claim, the evidence, source links and dates."}
              </li>
              <li>
                · {lang === "hi"
                  ? "प्रमाण अपर्याप्त होने पर निर्णय 'असत्यापित' होता है, अनुमान नहीं।"
                  : "When evidence is insufficient the verdict is UNVERIFIED — never a guess."}
              </li>
              <li>
                · {lang === "hi"
                  ? "हर निर्णय को चुनौती दी जा सकती है; सुधार सार्वजनिक रूप से दर्ज होते हैं।"
                  : "Every verdict can be challenged, and corrections are logged publicly."}
              </li>
            </ul>
          </div>
          <div className="border border-rule bg-paper p-4">
            <p className="kicker">{t("factCheck.askCorrection")}</p>
            <p className="mt-1.5 font-sans text-[0.82rem] leading-relaxed text-ink-soft">
              {lang === "hi"
                ? "अगर आपको लगता है कि हमारा निर्णय ग़लत है, तो साक्ष्य के साथ सुधार अनुरोध भेजें। हम हर अनुरोध की समीक्षा करते हैं और परिणाम प्रकाशित करते हैं।"
                : "If you believe a verdict is wrong, send a correction request with your evidence. We review every one and publish the outcome — including when we were at fault."}
            </p>
            <Link
              href="/submit?type=correction"
              className="mt-3 inline-block border-b border-gold pb-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
            >
              {t("submit.tabCorrection")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
