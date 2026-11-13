import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ShieldAlert } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { getViewer } from "@/lib/security/auth";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = {
  title: "Editorial desk",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const viewer = await getViewer();
  const allowed =
    viewer && (viewer.role === "admin" || viewer.role === "editor" || viewer.role === "researcher");

  if (!allowed) {
    return (
      <div className="container-editorial py-16">
        <div className="mx-auto max-w-lg border border-rule bg-white p-7 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-verdict-misleading" aria-hidden="true" />
          <h1 className="mt-3 font-serif text-[1.5rem] text-navy">{t("admin.denied")}</h1>
          <p className="mt-2 font-sans text-[0.87rem] leading-relaxed text-ink-soft">{t("admin.deniedBody")}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link href="/login" className="btn-primary w-full">
              {t("nav.login")}
            </Link>
            <Link href="/" className="btn-outline w-full">
              {t("nav.home")}
            </Link>
          </div>
          <p className="mt-4 font-sans text-[0.7rem] leading-relaxed text-ink-muted">
            Roles are assigned server-side. A frontend claim of a role is never trusted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper">
      {isDemoMode() && (
        <div className="border-b border-gold/50 bg-gold/[0.12]">
          <div className="container-editorial flex flex-wrap items-center gap-2 py-2">
            <span className="border border-gold-dark px-1.5 py-0.5 font-sans text-[0.55rem] uppercase tracking-[0.14em] text-gold-dark">
              Demo
            </span>
            <p className="font-sans text-[0.74rem] text-ink-soft">
              <strong className="font-medium text-ink">{t("admin.demoNotice")}</strong> {t("admin.demoBody")}
            </p>
          </div>
        </div>
      )}

      <div className="container-editorial py-7">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-4">
          <div>
            <p className="kicker-gold">{t("nav.admin")}</p>
            <h1 className="mt-1.5 font-serif text-[1.65rem] font-semibold text-navy">{t("admin.title")}</h1>
          </div>
          <p className="font-sans text-[0.7rem] uppercase tracking-[0.1em] text-ink-muted">
            {viewer.role} · {viewer.email ?? "demo session"}
          </p>
        </div>

        <AdminNav role={viewer.role} />

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
