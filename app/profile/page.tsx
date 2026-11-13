import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/security/auth";
import { getStore } from "@/lib/store";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const viewer = await getViewer();

  if (!viewer) redirect("/login?next=/profile");

  const store = getStore();
  const [bookmarks, submissions] = await Promise.all([
    viewer.authenticated ? store.listBookmarks(viewer.uid) : Promise.resolve([]),
    store.listSubmissions("all"),
  ]);

  const mySubmissions = viewer.email
    ? submissions.filter((s) => s.contactEmail?.toLowerCase() === viewer.email?.toLowerCase())
    : [];

  const isStaff = viewer.role === "editor" || viewer.role === "admin" || viewer.role === "researcher";
  const isContributor = viewer.role === "contributor";

  return (
    <div className="container-editorial py-9">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <p className="kicker-gold">{t("profile.title")}</p>
          <h1 className="mt-2 font-serif text-display-md font-semibold text-navy">
            {viewer.name ?? viewer.email ?? "Reader"}
          </h1>
          <p className="mt-1 font-sans text-[0.8rem] text-ink-muted">
            {viewer.email ?? (viewer.demo ? "Demo session — authentication not configured" : "Signed in")}
            <span className="mx-2" aria-hidden="true">·</span>
            {t("profile.role")}: <span className="uppercase tracking-[0.08em]">{viewer.role}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {isContributor && (
            <Link href="/contribute/desk" className="btn-primary">
              {t("nav.contributeDesk")}
            </Link>
          )}
          {isStaff && (
            <Link href="/admin" className="btn-outline">
              {t("nav.admin")}
            </Link>
          )}
          {viewer.authenticated && <SignOutButton />}
        </div>
      </div>

      {viewer.demo && (
        <p className="mt-4 border-l-2 border-gold bg-gold/[0.06] px-3 py-2 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
          {t("admin.demoBody")}
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <h2 className="section-heading font-serif text-[1.25rem] font-semibold text-navy">
            {t("profile.bookmarks")}
          </h2>
          <div className="mt-5 space-y-5">
            {bookmarks.length === 0 ? (
              <EmptyState
                title={t("profile.noBookmarks")}
                action={{ href: "/latest", label: t("nav.latest") }}
              />
            ) : (
              bookmarks.map((article) => (
                <ArticleCard key={article.id} article={article} lang={lang} variant="wide" />
              ))
            )}
          </div>
        </section>

        <aside className="lg:col-span-5">
          <h2 className="section-heading font-serif text-[1.25rem] font-semibold text-navy">
            {t("profile.submissions")}
          </h2>
          <div className="mt-5">
            {mySubmissions.length === 0 ? (
              <EmptyState
                title={t("profile.noSubmissions")}
                body={t("submit.lede")}
                action={{ href: "/submit", label: t("nav.submit") }}
              />
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {mySubmissions.map((submission) => (
                  <li key={submission.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-sans text-[0.6rem] uppercase tracking-[0.12em] text-gold-dark">
                        {submission.status}
                      </span>
                      <span className="font-sans text-[0.65rem] text-ink-muted">
                        {formatDate(submission.createdAt, lang)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 font-sans text-[0.82rem] leading-relaxed text-ink-soft">
                      {submission.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
