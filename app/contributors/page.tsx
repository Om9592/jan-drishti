import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, MapPin, PenLine } from "lucide-react";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { ArticleImage } from "@/components/ui/ArticleImage";
import { listContributorProfiles } from "@/lib/services/contributors";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Freelance contributors",
  description:
    "The freelance journalists and editors publishing with Jan Drishti — district reporters, data reporters and beat specialists, each with their own byline and page.",
  alternates: { canonical: "/contributors" },
};

export const dynamic = "force-dynamic";

export default async function ContributorsPage() {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);
  const profiles = await listContributorProfiles();
  const storyCount = profiles.reduce((sum, profile) => sum + profile.publishedCount, 0);

  return (
    <div className="container-editorial py-8 sm:py-10">
      <header className="border-b-2 border-navy pb-5">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gold" aria-hidden="true" />
          <p className="kicker-gold">{t("nav.contributors")}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-display-md font-semibold text-navy">The freelance desk</h1>
            <p className="mt-2 max-w-2xl font-sans text-[0.9rem] leading-relaxed text-ink-soft">
              Reporting from district courts, primary health centres and municipal offices — filed by journalists who
              do not work in a metro newsroom. Every story here was checked and approved by an editor before it went
              live.
            </p>
          </div>
          <div className="text-right">
            <p className="font-serif text-[1.9rem] leading-none text-navy">{profiles.length}</p>
            <p className="font-sans text-[0.6rem] uppercase tracking-[0.14em] text-ink-muted">contributors</p>
            <p className="mt-1.5 font-serif text-[1.3rem] leading-none text-navy">{storyCount}</p>
            <p className="font-sans text-[0.6rem] uppercase tracking-[0.14em] text-ink-muted">stories published</p>
          </div>
        </div>
      </header>

      {profiles.length === 0 ? (
        <div className="mt-8 border border-dashed border-rule-strong bg-paper-warm/40 px-6 py-12 text-center">
          <PenLine className="mx-auto h-6 w-6 text-ink-muted" aria-hidden="true" />
          <h2 className="mt-3 font-serif text-[1.25rem] text-navy">No contributor has published here yet</h2>
          <p className="mx-auto mt-1.5 max-w-md font-sans text-[0.85rem] leading-relaxed text-ink-soft">
            The desk is open and reading pitches. As soon as an editor approves a freelance story, its writer gets a
            page here with their byline and their work.
          </p>
          <Link href="/contribute" className="btn-primary mt-5">
            Write for us
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <article key={profile.id} className="group border border-rule bg-white">
              <Link href={`/contributors/${profile.slug}`} className="block">
                <div className="relative aspect-[16/9] overflow-hidden bg-paper-deep">
                  {profile.avatarUrl ? (
                    <ArticleImage src={profile.avatarUrl} alt="" ratio="16/9" className="h-full" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-navy/[0.04]">
                      <span className="font-serif text-[2.2rem] text-navy/30">
                        {profile.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-serif text-[1.15rem] font-semibold text-navy group-hover:text-gold-dark">
                    {profile.name}
                  </h2>
                  <p className="mt-1 font-sans text-[0.72rem] leading-relaxed text-ink-soft">
                    {profile.beats || "Freelance contributor"}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 font-sans text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted">
                    {profile.location && (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {profile.location}
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{profile.publishedCount} {profile.publishedCount === 1 ? "story" : "stories"}</span>
                  </p>
                </div>
              </Link>
              {profile.latest[0] && (
                <div className="border-t border-rule px-4 py-3">
                  <p className="font-sans text-[0.58rem] uppercase tracking-[0.12em] text-gold-dark">Latest</p>
                  <Link
                    href={`/article/${profile.latest[0].slug}`}
                    className="mt-1 line-clamp-2 block font-serif text-[0.95rem] leading-snug text-navy hover:text-gold-dark"
                  >
                    {profile.latest[0].title}
                  </Link>
                  <p className="mt-1 font-sans text-[0.62rem] text-ink-muted">
                    {formatDate(profile.latest[0].publishedAt ?? profile.latest[0].updatedAt, lang)}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {profiles.length > 0 && (
        <section className="mt-10 border-t border-rule pt-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Report from where the story is</h2>
              <p className="mt-1.5 max-w-2xl font-sans text-[0.88rem] leading-relaxed text-ink-soft">
                Contributors keep their own account and their own desk. They file from it, an editor reviews every
                submission, and approved work carries the writer&apos;s own byline and page. Nothing is published
                without that sign-off.
              </p>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <Link href="/contribute" className="btn-primary">
                Pitch the desk
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {profiles.length > 0 && profiles[0].latest.length > 0 && (
        <section className="mt-9">
          <h2 className="border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
            Latest from freelance contributors
          </h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {profiles
              .flatMap((profile) => profile.latest.slice(0, 2))
              .sort((a, b) => Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0"))
              .slice(0, 6)
              .map((article) => (
                <ArticleCard key={article.id} article={article} lang={lang} variant="standard" />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
