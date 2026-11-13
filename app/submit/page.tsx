import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Clock3, Lock, ShieldCheck } from "lucide-react";
import { SubmitTabs } from "@/components/factcheck/SubmitTabs";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Submit a claim, tip or correction",
  description:
    "Send Jan Drishti a viral WhatsApp claim, a news tip from your district, or a correction request. Every submission is read by a person.",
  alternates: { canonical: "/submit" },
};

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);

  const typeParam = typeof params.type === "string" ? params.type : "";
  const initialType =
    typeParam === "correction" || typeParam === "correction_request"
      ? "correction_request"
      : typeParam === "tip" || typeParam === "news_tip"
        ? "news_tip"
        : "viral_claim";

  return (
    <div className="container-editorial py-9">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gold" aria-hidden="true" />
            <p className="kicker-gold">{t("nav.submit")}</p>
          </div>
          <h1 className="mt-3 font-serif text-display-md font-semibold text-navy">{t("submit.title")}</h1>
          <p className="mt-3 max-w-xl font-sans text-[0.95rem] leading-relaxed text-ink-soft">{t("submit.lede")}</p>

          {typeof params.ref === "string" && params.ref && (
            <p className="mt-4 border-l-2 border-gold bg-gold/[0.06] px-3 py-2 font-sans text-[0.78rem] text-ink-soft">
              {lang === "hi" ? "संदर्भ" : "Referring to"}: <span className="font-medium">{params.ref}</span>
            </p>
          )}

          <div className="mt-7 border border-rule bg-white p-5 sm:p-6">
            <SubmitTabs initialType={initialType} />
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="space-y-6 lg:sticky lg:top-16">
            <div className="border border-rule bg-paper p-5">
              <p className="kicker-gold">{lang === "hi" ? "आपका सबमिशन कहाँ जाता है" : "Where your submission goes"}</p>
              <ol className="mt-3 space-y-3">
                {[
                  lang === "hi"
                    ? "सबमिशन सुरक्षित रूप से दर्ज होता है और एक संदर्भ संख्या मिलती है।"
                    : "Your submission is stored securely and given a reference number.",
                  lang === "hi"
                    ? "एक शोधकर्ता इसे 48 घंटे में प्राथमिकता देता है।"
                    : "A researcher triages it, usually within 48 hours.",
                  lang === "hi"
                    ? "प्रमाण जुटाए जाते हैं और संपादक निर्णय देता है।"
                    : "Evidence is gathered, then an editor decides whether it can be published.",
                  lang === "hi"
                    ? "प्रकाशन से पहले आपकी पहचान कभी सार्वजनिक नहीं होती।"
                    : "Your identity is never published, whatever the outcome.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-navy/25 font-sans text-[0.58rem] text-navy">
                      {index + 1}
                    </span>
                    <span className="font-sans text-[0.8rem] leading-relaxed text-ink-soft">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-3 border-t border-rule pt-4">
              <p className="flex items-start gap-2 font-sans text-[0.75rem] leading-relaxed text-ink-soft">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
                {lang === "hi"
                  ? "हम केवल वही प्रकाशित करते हैं जो सत्यापित हो सके। कोई दावा स्वतः प्रकाशित नहीं होता।"
                  : "We publish only what we can verify. No submission is ever auto-published."}
              </p>
              <p className="flex items-start gap-2 font-sans text-[0.75rem] leading-relaxed text-ink-soft">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
                {lang === "hi"
                  ? "संपर्क विवरण केवल संपादकीय टीम देख सकती है।"
                  : "Contact details are visible only to the editorial team."}
              </p>
              <p className="flex items-start gap-2 font-sans text-[0.75rem] leading-relaxed text-ink-soft">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
                {lang === "hi"
                  ? "सुधार अनुरोधों का जवाब 24 घंटे में देने का प्रयास।"
                  : "We aim to answer correction requests within 24 hours."}
              </p>
            </div>

            <div className="border-t border-rule pt-4">
              <p className="font-sans text-[0.75rem] leading-relaxed text-ink-muted">
                {lang === "hi" ? "संपादकीय मानक पढ़ें:" : "Read our standards:"}{" "}
                <Link href="/fact-checking-methodology" className="text-navy underline decoration-gold underline-offset-2">
                  {t("footer.methodology")}
                </Link>{" "}
                ·{" "}
                <Link href="/editorial-policy" className="text-navy underline decoration-gold underline-offset-2">
                  {t("footer.policy")}
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
