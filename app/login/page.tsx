import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { getViewer } from "@/lib/security/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Jan Drishti to save stories and follow fact checks.",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const viewer = await getViewer();
  if (viewer?.authenticated) redirect("/profile");

  return (
    <div className="container-editorial py-10">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gold" aria-hidden="true" />
            <p className="kicker-gold">{t("nav.login")}</p>
          </div>
          <h1 className="mt-3 font-serif text-display-md font-semibold text-navy">{t("auth.loginTitle")}</h1>
          <p className="mt-3 max-w-md font-sans text-[0.92rem] leading-relaxed text-ink-soft">{t("auth.loginLede")}</p>

          <ul className="mt-6 space-y-2.5 border-t border-rule pt-4">
            {[
              "Save stories to read later.",
              "Track the status of claims you submitted.",
              "Editorial staff: access the review desk with role-based permissions.",
            ].map((item) => (
              <li key={item} className="flex gap-2 font-sans text-[0.82rem] leading-relaxed text-ink-soft">
                <span className="mt-2 h-1 w-1 shrink-0 bg-gold" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-6 font-sans text-[0.72rem] leading-relaxed text-ink-muted">
            We store your email, display name and saved stories. Nothing else. See the{" "}
            <a href="/privacy" className="text-navy underline decoration-gold underline-offset-2">
              privacy policy
            </a>
            .
          </p>
        </div>

        <div className="lg:col-span-6 lg:pl-8">
          <Suspense fallback={<div className="h-80 border border-rule bg-paper" aria-hidden="true" />}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
