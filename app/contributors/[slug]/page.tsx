import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, MapPin } from "lucide-react";
import { ArticleCard } from "@/components/ui/ArticleCard";
import { ArticleImage } from "@/components/ui/ArticleImage";
import { getContributorProfileBySlug } from "@/lib/services/contributors";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getContributorProfileBySlug(slug);
  if (!profile) return { title: "Contributor not found" };
  return {
    title: `${profile.name} — freelance contributor`,
    description:
      profile.beats || `${profile.name} reports for Jan Drishti as a freelance contributor. Their published work is listed here.`,
    alternates: { canonical: `/contributors/${profile.slug}` },
    openGraph: { title: `${profile.name} · Jan Drishti`, type: "profile" },
  };
}

export default async function ContributorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);

  const profile = await getContributorProfileBySlug(slug);
  if (!profile) notFound();

  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="container-editorial py-8 sm:py-10">
      <Link
        href="/contributors"
        className="inline-flex items-center gap-1.5 font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted hover:text-navy"
      >
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> {t("nav.contributors")}
      </Link>

      <header className="mt-4 grid gap-6 border-b-2 border-navy pb-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="relative aspect-[1/1] w-32 overflow-hidden bg-paper-deep sm:w-full">
          {profile.avatarUrl ? (
            <ArticleImage src={profile.avatarUrl} alt={profile.name} ratio="1/1" className="h-full" />
          ) : (
            <div className="flex h-full items-center justify-center bg-navy/[0.04]">
              <span className="font-serif text-[2.4rem] text-navy/30">{initials}</span>
            </div>
          )}
        </div>
        <div>
          <p className="kicker-gold">Freelance contributor</p>
          <h1 className="mt-1.5 font-serif text-display-md font-semibold text-navy">{profile.name}</h1>
          {profile.beats && (
            <p className="mt-2 max-w-2xl font-serif text-[1.02rem] italic leading-relaxed text-ink-soft">
              {profile.beats}
            </p>
          )}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {profile.location}
              </span>
            )}
            <span>
              {profile.publishedCount} {profile.publishedCount === 1 ? "story" : "stories"} published
            </span>
            <span>With the desk since {formatDate(profile.joinedAt, lang)}</span>
          </p>
          {profile.bio && (
            <div className="mt-4 max-w-2xl space-y-2 font-sans text-[0.88rem] leading-relaxed text-ink-soft">
              {profile.bio.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          )}
          <p className="mt-4 max-w-2xl border-l-2 border-gold/70 bg-gold/[0.05] px-3 py-2 font-sans text-[0.74rem] leading-relaxed text-ink-soft">
            Freelance copy is held to the same standard as staff copy: an editor checks the sourcing and signs off
            every story before it is published. The byline is the writer&apos;s own.
          </p>
        </div>
      </header>

      <section className="mt-8">
        <h2 className="border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
          Stories by {profile.name} · {profile.publishedCount}
        </h2>
        {profile.latest.length === 0 ? (
          <p className="mt-4 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-8 text-center font-sans text-[0.85rem] text-ink-muted">
            Nothing published under this byline yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {profile.latest.map((article) => (
              <ArticleCard key={article.id} article={article} lang={lang} variant="standard" />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 border-t border-rule pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl font-sans text-[0.85rem] leading-relaxed text-ink-soft">
            Report from your district? The freelance desk reads every pitch, and approved stories are published with
            your own byline and a page like this one.
          </p>
          <Link href="/contribute" className="btn-primary">
            Pitch a story
          </Link>
        </div>
      </section>
    </div>
  );
}
