import Link from "next/link";
import { cookies } from "next/headers";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";

export default async function NotFound() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);

  return (
    <div className="container-editorial py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-gold-dark">404</p>
        <h1 className="mt-3 font-serif text-display-md font-semibold text-navy">{t("notFound.title")}</h1>
        <p className="mt-3 font-sans text-[0.9rem] leading-relaxed text-ink-soft">{t("notFound.body")}</p>
        <span className="mx-auto mt-6 block h-px w-12 bg-gold" aria-hidden="true" />
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/search" className="btn-primary">
            {t("notFound.cta")}
          </Link>
          <Link href="/" className="btn-outline">
            {t("nav.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
