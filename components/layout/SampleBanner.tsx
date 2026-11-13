import { createTranslator, type Lang } from "@/lib/i18n";
import { isDemoMode, isFirebaseAdminConfigured } from "@/lib/config";

/**
 * Honesty banner. Present on every page whenever the app is not connected to
 * a real database, so no reader can mistake sample content for reporting.
 */
export function SampleBanner({ lang }: { lang: Lang }) {
  if (isFirebaseAdminConfigured()) return null;
  const t = createTranslator(lang);

  return (
    <div className="border-b border-gold/40 bg-gold/[0.08]">
      <div className="container-editorial flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <span className="border border-gold-dark px-1.5 py-0.5 font-sans text-[0.55rem] uppercase tracking-[0.14em] text-gold-dark">
          {lang === "hi" ? "प्रीव्यू" : "Preview"}
        </span>
        <p className="font-sans text-[0.72rem] leading-relaxed text-ink-soft">
          <span className="sm:hidden">
            {lang === "hi"
              ? "प्रीव्यू बिल्ड — नमूना सामग्री, कोई लाइव रिपोर्टिंग नहीं।"
              : "Preview build — labelled sample content, not live reporting."}
          </span>
          <span className="hidden sm:inline">
            {t("banner.sample")}
            {isDemoMode() && <span className="ml-1 text-ink-muted">— {t("banner.demo")}</span>}
          </span>
        </p>
      </div>
    </div>
  );
}
