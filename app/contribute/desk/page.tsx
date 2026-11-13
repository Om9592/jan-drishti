import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight, FileText, Plus, ShieldAlert, ShieldCheck } from "lucide-react";
import { getStore } from "@/lib/store";
import { getViewer } from "@/lib/security/auth";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contributor desk",
  robots: { index: false, follow: false },
};

const STATUS_COPY: Record<string, { label: string; note: string; tone: string }> = {
  draft: {
    label: "Draft",
    note: "Only you can see this. Submit it when you are ready for an editor to read it.",
    tone: "border-rule text-ink-muted",
  },
  review: {
    label: "With the desk",
    note: "An editor is reading it. You can still fix typos — changes are versioned and visible to the reviewer.",
    tone: "border-gold-dark text-gold-dark",
  },
  scheduled: {
    label: "Approved · scheduled",
    note: "Approved and queued to go live at the scheduled time.",
    tone: "border-navy/40 text-navy",
  },
  published: {
    label: "Published",
    note: "Live with your byline.",
    tone: "border-verdict-true text-verdict-true",
  },
  archived: {
    label: "Archived",
    note: "Taken down. Speak to the desk before re-filing.",
    tone: "border-rule-strong text-ink-soft",
  },
};

export default async function ContributorDeskPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) {
    redirect("/login?next=/contribute/desk");
  }
  if (viewer.role === "user") {
    return (
      <div className="container-editorial py-16">
        <div className="mx-auto max-w-lg border border-rule bg-white p-7 text-center">
          <ShieldAlert className="mx-auto h-7 w-7 text-verdict-misleading" aria-hidden="true" />
          <h1 className="mt-3 font-serif text-[1.5rem] text-navy">This account is not on the contributor desk</h1>
          <p className="mt-2 font-sans text-[0.87rem] leading-relaxed text-ink-soft">
            Freelance contributors are added after an editor reads a pitch. If you have already applied, your
            invitation mail is on its way.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link href="/contribute" className="btn-primary w-full">
              Pitch the desk
            </Link>
            <Link href="/" className="btn-outline w-full">
              Front page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const store = getStore();
  const mine = await store.listArticles({ status: "all", authorId: viewer.uid, limit: 100, sort: "latest" });
  const cookieStore = await cookies();
  const isStaff = viewer.role === "editor" || viewer.role === "admin";

  const counts = {
    draft: mine.items.filter((a) => a.status === "draft").length,
    review: mine.items.filter((a) => a.status === "review").length,
    published: mine.items.filter((a) => a.status === "published" || a.status === "scheduled").length,
  };

  return (
    <div className="container-editorial py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-4">
        <div>
          <p className="kicker-gold">Contributor desk</p>
          <h1 className="mt-1.5 font-serif text-[1.75rem] font-semibold text-navy">Your byline, your drafts</h1>
          <p className="mt-1 font-sans text-[0.78rem] text-ink-muted">
            {viewer.name ?? viewer.email ?? "Contributor"} · {viewer.role}
            {isStaff && (
              <>
                {" · "}
                <Link href="/admin" className="underline decoration-rule underline-offset-2 hover:text-navy">
                  staff desk
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href="/contribute/desk/new" className="btn-primary">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New story
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Drafts", value: counts.draft },
          { label: "With the desk", value: counts.review },
          { label: "Published", value: counts.published },
        ].map((stat) => (
          <div key={stat.label} className="border border-rule bg-white px-4 py-3">
            <p className="font-serif text-[1.6rem] leading-none text-navy">{stat.value}</p>
            <p className="mt-1 font-sans text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 border border-navy/20 bg-white p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden="true" />
          <div>
            <p className="font-sans text-[0.82rem] font-medium text-ink">Nothing you file goes live on its own</p>
            <p className="mt-0.5 font-sans text-[0.8rem] leading-relaxed text-ink-soft">
              Submitting sends your story to the editorial queue. A named editor checks sourcing, defamation risk and
              the image rights, then approves. Only after that approval does the story appear on the site — and only
              then does it carry your byline.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7">
        <h2 className="border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
          Your stories · {mine.items.length}
        </h2>
        {mine.items.length === 0 ? (
          <div className="mt-4 border border-dashed border-rule-strong bg-paper-warm/40 px-5 py-10 text-center">
            <FileText className="mx-auto h-6 w-6 text-ink-muted" aria-hidden="true" />
            <p className="mt-3 font-serif text-[1.1rem] text-navy">No stories yet</p>
            <p className="mx-auto mt-1 max-w-md font-sans text-[0.82rem] leading-relaxed text-ink-soft">
              Start with a draft. You can keep it private for as long as you like — nothing is sent to the desk until
              you press “Submit for editorial review”.
            </p>
            <Link href="/contribute/desk/new" className="btn-primary mt-4">
              Write the first draft
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {mine.items.map((article) => {
              const meta = STATUS_COPY[article.status] ?? {
                label: article.status,
                note: "",
                tone: "border-rule text-ink-muted",
              };
              return (
                <li key={article.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/contribute/desk/${article.id}`}
                      className="line-clamp-1 font-serif text-[1.02rem] text-navy hover:text-gold-dark"
                    >
                      {article.title || "Untitled draft"}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-[0.62rem] text-ink-muted">
                      <span>{article.categorySlug ?? "—"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{article.language.toUpperCase()}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateTime(article.updatedAt)}</span>
                      {article.status === "published" && (
                        <>
                          <span aria-hidden="true">·</span>
                          <Link href={`/article/${article.slug}`} className="underline decoration-rule underline-offset-2">
                            view live
                          </Link>
                        </>
                      )}
                    </p>
                    {meta.note && <p className="mt-1 max-w-xl font-sans text-[0.72rem] text-ink-soft">{meta.note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`border px-1.5 py-0.5 font-sans text-[0.56rem] uppercase tracking-[0.1em] ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <Link
                      href={`/contribute/desk/${article.id}`}
                      className="border border-navy px-2.5 py-1 font-sans text-[0.58rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper"
                    >
                      {article.status === "draft" ? "Continue" : "Open"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
