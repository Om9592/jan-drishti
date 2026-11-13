import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Users } from "lucide-react";
import { getStore } from "@/lib/store";
import { getViewer } from "@/lib/security/auth";
import { redirect } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import { ApplicationDecision, PublishStoryButton } from "@/components/admin/ContributorActions";

export const metadata: Metadata = {
  title: "Contributors",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseApplication(content: string) {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const beats = lines.find((l) => l.startsWith("Beats:"))?.replace("Beats:", "").trim();
  const experience = lines.find((l) => l.startsWith("Experience:"))?.replace("Experience:", "").trim();
  const location = lines.find((l) => l.startsWith("Location:"))?.replace("Location:", "").trim();
  const pitchIndex = lines.findIndex((l) => l.startsWith("Pitch:"));
  const pitch =
    pitchIndex >= 0
      ? [lines[pitchIndex].replace("Pitch:", "").trim(), ...lines.slice(pitchIndex + 1)].join("\n")
      : content;
  return { beats, experience, location, pitch };
}

export default async function AdminContributorsPage() {
  const viewer = await getViewer();
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "editor")) {
    redirect("/admin");
  }

  const store = getStore();
  const [submissions, articles, users] = await Promise.all([
    store.listSubmissions("all"),
    store.listArticles({ status: "all", limit: 200, sort: "latest" }),
    store.listUsers(),
  ]);

  const applications = submissions
    .filter((s) => s.type === "contributor_application")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pending = applications.filter((a) => a.status === "received");
  const decided = applications.filter((a) => a.status !== "received");

  const inReview = articles.items.filter((a) => a.status === "review");
  const contributorCount = users.filter((u) => u.role === "contributor").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Freelance contributors</h2>
          <p className="mt-1 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-muted">
            Approving an application creates the account, grants the contributor role and mails a password-set link.
            Contributor stories stay in review until an editor publishes them here.
          </p>
        </div>
        <div className="flex gap-4 font-sans text-[0.68rem] uppercase tracking-[0.1em] text-ink-muted">
          <span>{pending.length} pending</span>
          <span>{contributorCount} on the roster</span>
          <span>{inReview.length} in review</span>
        </div>
      </div>

      <section className="mt-7">
        <h3 className="flex items-center gap-2 border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
          <Inbox className="h-3.5 w-3.5" aria-hidden="true" /> Applications · {pending.length}
        </h3>
        {pending.length === 0 ? (
          <p className="mt-3 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-6 text-center font-sans text-[0.82rem] text-ink-muted">
            No open pitches. New applications arrive at{" "}
            <Link href="/contribute" className="underline decoration-rule underline-offset-2 hover:text-navy">
              /contribute
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-rule">
            {pending.map((application) => {
              const parsed = parseApplication(application.content);
              return (
                <li key={application.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-[1.02rem] text-navy">
                      {application.submitterName ?? "Unnamed applicant"}
                      <span className="ml-2 font-sans text-[0.7rem] text-ink-muted">
                        {application.contactEmail ?? "no email"}
                      </span>
                    </p>
                    <p className="font-sans text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted">
                      {formatDateTime(application.createdAt)}
                    </p>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 font-sans text-[0.68rem] text-ink-muted">
                    {parsed.beats && <span>Beats: {parsed.beats}</span>}
                    {parsed.experience && <span>Experience: {parsed.experience}</span>}
                    {parsed.location && <span>{parsed.location}</span>}
                  </p>
                  <p className="mt-2 max-w-3xl whitespace-pre-line font-sans text-[0.82rem] leading-relaxed text-ink-soft">
                    {parsed.pitch}
                  </p>
                  <ApplicationDecision submissionId={application.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-9">
        <h3 className="border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
          Stories awaiting approval · {inReview.length}
        </h3>
        {inReview.length === 0 ? (
          <p className="mt-3 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-6 text-center font-sans text-[0.82rem] text-ink-muted">
            Nothing in the queue. Contributor submissions land here the moment a writer files them.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-rule">
            {inReview.map((article) => (
              <li key={article.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/articles/${article.id}`}
                    className="line-clamp-1 font-serif text-[1rem] text-navy hover:text-gold-dark"
                  >
                    {article.title || "Untitled"}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-[0.62rem] text-ink-muted">
                    <span>{article.authorName ?? article.authorId}</span>
                    <span aria-hidden="true">·</span>
                    <span>{article.categorySlug ?? "—"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{article.language.toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTime(article.updatedAt)}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-soft">
                    {article.summary}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/articles/${article.id}`}
                    className="border border-rule px-2.5 py-1 font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-soft hover:border-navy hover:text-navy"
                  >
                    Open
                  </Link>
                  <PublishStoryButton articleId={article.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-9">
        <h3 className="flex items-center gap-2 border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> Roster · {contributorCount}
        </h3>
        {contributorCount === 0 ? (
          <p className="mt-3 font-sans text-[0.82rem] text-ink-muted">
            No contributors yet. Approve an application above to add the first one.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-rule">
            {users
              .filter((user) => user.role === "contributor")
              .map((user) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-sans text-[0.85rem] text-ink">{user.name || "—"}</p>
                    <p className="font-sans text-[0.65rem] text-ink-muted">{user.email ?? user.id}</p>
                  </div>
                  <p className="font-sans text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted">
                    {articles.items.filter((a) => a.authorId === user.id).length} stories filed
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="mt-9">
          <h3 className="border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
            Decided applications · {decided.length}
          </h3>
          <ul className="mt-1 divide-y divide-rule">
            {decided.slice(0, 12).map((application) => (
              <li key={application.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <p className="font-sans text-[0.8rem] text-ink-soft">
                  {application.submitterName ?? "Unnamed"} · {application.contactEmail ?? "no email"}
                </p>
                <p className="font-sans text-[0.62rem] uppercase tracking-[0.08em] text-ink-muted">
                  {application.status} · {application.triageNote ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
