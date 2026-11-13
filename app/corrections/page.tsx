import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { PageShell } from "@/components/pages/PageShell";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Corrections and Updates",
  description:
    "Every correction and clarification issued by Jan Drishti, dated and permanently public — including the ones that make us look bad.",
  alternates: { canonical: "/corrections" },
};

const SEVERITY_LABEL = {
  material: { en: "Material correction", hi: "महत्वपूर्ण सुधार" },
  minor: { en: "Minor correction", hi: "मामूली सुधार" },
  clarification: { en: "Clarification", hi: "स्पष्टीकरण" },
};

export default async function CorrectionsPage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const store = getStore();
  const corrections = await store.listCorrections();

  return (
    <PageShell
      kicker="Accountability"
      title="Corrections and updates"
      lede="A correction nobody can find is not a correction. Every notice we issue is dated, numbered and kept here permanently."
      aside={{
        title: "Our promises",
        links: [
          { href: "/editorial-policy#corrections", label: "Corrections policy" },
          { href: "/fact-checking-methodology", label: "Fact-checking method" },
          { href: "/submit?type=correction", label: "Request a correction" },
        ],
      }}
    >
      <div className="space-y-4">
        <div className="border-l-2 border-gold bg-gold/[0.06] px-4 py-3">
          <p className="font-sans text-[0.82rem] leading-relaxed text-ink-soft">
            {lang === "hi"
              ? "सुधार कभी हटाए नहीं जाते। कोई ग़लती पाएँ तो सुधार अनुरोध भेजें — आपको खाता बनाने की ज़रूरत नहीं।"
              : "Corrections are never deleted. If you spot an error, send a correction request — you do not need an account."}{" "}
            <Link
              href="/submit?type=correction"
              className="font-medium text-navy underline decoration-gold underline-offset-2"
            >
              {t("submit.tabCorrection")}
            </Link>
          </p>
        </div>

        {corrections.length === 0 ? (
          <p className="border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-8 text-center font-serif text-[1.05rem] text-navy">
            {lang === "hi"
              ? "इस समय कोई खुली सुधार-सूचना नहीं है।"
              : "No corrections have been issued. When one is, it will appear here permanently."}
          </p>
        ) : (
          <ol className="divide-y divide-rule border-y border-rule">
            {corrections.map((correction) => (
              <li key={correction.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-sans text-[0.6rem] uppercase tracking-[0.14em] text-gold-dark">
                    {SEVERITY_LABEL[correction.severity][lang]}
                  </span>
                  <time
                    dateTime={correction.date}
                    className="font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted"
                  >
                    {formatDate(correction.date, lang)}
                  </time>
                </div>
                <h2 className="mt-1.5 font-serif text-[1.08rem] leading-snug text-navy">
                  {lang === "hi" && correction.summaryHi ? correction.summaryHi : correction.summaryEn}
                </h2>
                {(correction.detailEn || correction.detailHi) && (
                  <p className="mt-1.5 font-sans text-[0.84rem] leading-relaxed text-ink-soft">
                    {lang === "hi" && correction.detailHi ? correction.detailHi : correction.detailEn}
                  </p>
                )}
                <p className="mt-1.5 font-sans text-[0.68rem] text-ink-muted">
                  {lang === "hi" ? "जारीकर्ता" : "Issued by"}: {correction.issuedBy}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </PageShell>
  );
}
