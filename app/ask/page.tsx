import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ChatInterface } from "@/components/factcheck/ChatInterface";
import { capabilities } from "@/lib/config";
import { normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Ask the checker — verify a claim",
  description:
    "Type any claim or forwarded message. The checker searches reporting and official records, cross-checks with several independent models, and answers with the sources it used.",
  robots: { index: true, follow: true },
};

export default async function AskPage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const caps = capabilities();
  const hi = lang === "hi";

  return (
    <div className="bg-paper">
      <div className="container-editorial py-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-px w-6 bg-gold" aria-hidden="true" />
              <p className="kicker-gold">{hi ? "तुरंत सत्यापन" : "Instant verification"}</p>
            </div>
            <h1 className="mt-1.5 font-serif text-[1.6rem] font-semibold leading-tight text-navy">
              {hi ? "किसी भी दावे की जाँच करें" : "Check any claim, in a conversation"}
            </h1>
          </div>
          <p className="max-w-md font-sans text-[0.72rem] leading-relaxed text-ink-muted">
            {hi
              ? "जवाब मशीन देती है — तीन मॉडल, कई स्वतंत्र स्रोत, और एक पुनः जाँच। प्रकाशित फ़ैसला संपादक देता है।"
              : "The machine answers — three models, several independent sources, one re-check. Published verdicts remain an editor's call."}
          </p>
        </div>

        <div className="mt-4">
          <ChatInterface />
        </div>

        <p className="mt-3 font-sans text-[0.68rem] leading-relaxed text-ink-muted">
          {caps.ai
            ? hi
              ? "AI जाँच सक्रिय है। हर जवाब मशीन का है और हर जाँच का रिकॉर्ड संपादकीय डेस्क तक जाता है।"
              : "The AI checker is active. Every answer is machine output, and every check is logged for the editorial desk."
            : hi
              ? "AI जाँच कॉन्फ़िगर नहीं है — दावा संपादकीय डेस्क को भेजें, शोधकर्ता खुद जाँचेंगे। कोई नक़ली जवाब नहीं बनेगा।"
              : "The AI checker is not configured here — send the claim to the editorial desk and a researcher will verify it. No answer is ever simulated."}
        </p>
      </div>
    </div>
  );
}
