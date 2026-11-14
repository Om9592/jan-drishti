import Link from "next/link";
import { ArrowUpRight, Database, Search, Sparkles, FileText, ScanText } from "lucide-react";
import { getStore } from "@/lib/store";
import { listPublicChecks } from "@/lib/services/public-checks";
import { getViewer } from "@/lib/security/auth";
import { capabilities } from "@/lib/config";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { VerdictBadge } from "@/components/ui/VerdictBadge";

export default async function AdminOverviewPage() {
  // Same reason as the AI-answer log: no desk data is read or serialised for a
  // viewer without a desk role.
  const viewer = await getViewer();
  if (!viewer || !["admin", "editor", "researcher"].includes(viewer.role)) return null;

  const store = getStore();
  const [stats, factChecks, submissions, audit, articles, aiCheckList] = await Promise.all([
    store.getStats(),
    store.listFactChecks({ status: "all", limit: 20 }),
    store.listSubmissions("all"),
    store.listAuditLogs(8),
    store.listArticles({ status: "all", limit: 8, sort: "latest" }),
    listPublicChecks(50),
  ]);
  const aiChecks = aiCheckList.length;
  const caps = capabilities();

  const pending = factChecks.items.filter((f) => f.status !== "published" && f.status !== "rejected");
  const openSubmissions = submissions.filter((s) => s.status === "received" || s.status === "triaged");

  const cards = [
    { label: "Published articles", value: stats.publishedArticles, href: "/admin/articles" },
    { label: "Drafts in progress", value: stats.drafts, href: "/admin/articles" },
    { label: "Awaiting verdict", value: pending.length, href: "/admin/fact-checks", accent: true },
    { label: "Open submissions", value: openSubmissions.length, href: "/admin/submissions" },
    { label: "Published fact checks", value: stats.publishedFactChecks, href: "/admin/fact-checks" },
    { label: "AI answers to the public", value: aiChecks, href: "/admin/ai-checks" },
    { label: "Corrections issued", value: stats.corrections, href: "/admin/corrections" },
  ];

  const integrations = [
    {
      icon: Database,
      label: "Database",
      value: caps.database === "firestore" ? "Firestore connected" : "Sample store (not persistent)",
      ok: caps.database === "firestore",
      hint: "Set FIREBASE_PROJECT_ID + service account credentials.",
    },
    {
      icon: Sparkles,
      label: "AI synthesis",
      value: caps.ai ? "Configured" : "Needs one key",
      ok: caps.ai,
      hint: "Set AI_API_KEY with AI_PROVIDER=gemini|groq|openai|openrouter|deepseek. One key is enough; verdicts still need an editor.",
    },
    {
      icon: Search,
      label: "Evidence retrieval",
      value: "Live · keyless",
      ok: true,
      hint: "Google News, Bing News, the trusted wire and Wikipedia run without credentials. Paid keys (TAVILY / BRAVE / SERPER) add another index.",
    },
    {
      icon: ScanText,
      label: "Screenshot OCR",
      value: caps.ocr ? "Configured" : "Not configured",
      ok: caps.ocr,
      hint: "OCR uses the configured AI vision model.",
    },
  ];

  return (
    <div className="space-y-9">
      <section>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`group border p-3.5 transition-colors ${
                card.accent ? "border-gold/60 bg-gold/[0.07] hover:border-gold" : "border-rule bg-white hover:border-navy/40"
              }`}
            >
              <p className="font-serif text-[1.7rem] leading-none text-navy">{card.value}</p>
              <p className="mt-1.5 min-h-[1.6rem] font-sans text-[0.62rem] uppercase leading-tight tracking-[0.1em] text-ink-muted">
                {card.label}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <h2 className="section-heading font-serif text-[1.15rem] font-semibold text-navy">
            Awaiting an editorial verdict
          </h2>
          {pending.length === 0 ? (
            <p className="mt-4 border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-6 text-center font-sans text-[0.82rem] text-ink-muted">
              Nothing in review. Files appear here when research is run.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {pending.map((fc) => (
                <li key={fc.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <VerdictBadge verdict={fc.verdict} size="sm" />
                        <span className="font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                          {fc.status}
                        </span>
                      </div>
                      <Link
                        href={`/admin/fact-checks/${fc.id}`}
                        className="mt-1.5 block font-serif text-[0.98rem] leading-snug text-navy hover:text-gold-dark"
                      >
                        {fc.headlineEn}
                      </Link>
                      <p className="mt-0.5 font-sans text-[0.68rem] text-ink-muted">
                        {fc.research?.aiConfigured ? "AI-assisted draft" : "Manual file"} ·{" "}
                        {timeAgo(fc.updatedAt)} · {fc.supportingEvidence.length + fc.contradictingEvidence.length} evidence items
                      </p>
                    </div>
                    <Link
                      href={`/admin/fact-checks/${fc.id}`}
                      className="shrink-0 border border-navy px-2.5 py-1 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="section-heading mt-8 font-serif text-[1.15rem] font-semibold text-navy">
            Reader submissions
          </h2>
          {openSubmissions.length === 0 ? (
            <p className="mt-4 font-sans text-[0.82rem] text-ink-muted">No open submissions.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {openSubmissions.slice(0, 4).map((submission) => (
                <li key={submission.id} className="border border-rule bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-[0.58rem] uppercase tracking-[0.12em] text-gold-dark">
                      {submission.type.replace("_", " ")} · {submission.status}
                    </span>
                    <span className="font-sans text-[0.62rem] text-ink-muted">
                      {timeAgo(submission.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-sans text-[0.8rem] leading-relaxed text-ink-soft">
                    {submission.content}
                  </p>
                  <Link
                    href={`/admin/submissions`}
                    className="mt-1.5 inline-flex items-center gap-1 font-sans text-[0.6rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
                  >
                    Triage <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:col-span-5">
          <h2 className="section-heading font-serif text-[1.15rem] font-semibold text-navy">Integration status</h2>
          <ul className="mt-3 space-y-2">
            {integrations.map(({ icon: Icon, label, value, ok, hint }) => (
              <li key={label} className="border border-rule bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-sans text-[0.68rem] uppercase tracking-[0.1em] text-ink-muted">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                  </span>
                  <span
                    className={`font-sans text-[0.62rem] uppercase tracking-[0.08em] ${
                      ok ? "text-verdict-true" : "text-verdict-misleading"
                    }`}
                  >
                    {value}
                  </span>
                </div>
                {!ok && <p className="mt-1 font-sans text-[0.68rem] leading-relaxed text-ink-muted">{hint}</p>}
              </li>
            ))}
          </ul>

          <h2 className="section-heading mt-8 font-serif text-[1.15rem] font-semibold text-navy">Recent activity</h2>
          <ul className="mt-3 space-y-2.5">
            {audit.map((entry) => (
              <li key={entry.id} className="border-l border-rule pl-2.5">
                <p className="font-sans text-[0.75rem] leading-snug text-ink-soft">{entry.summary}</p>
                <p className="mt-0.5 font-sans text-[0.6rem] uppercase tracking-[0.08em] text-ink-muted">
                  {entry.action} · {entry.actorEmail ?? entry.actorId} · {formatDateTime(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>

          <h2 className="section-heading mt-8 font-serif text-[1.15rem] font-semibold text-navy">Recent articles</h2>
          <ul className="mt-3 space-y-2">
            {articles.items.map((article) => (
              <li key={article.id} className="flex items-center justify-between gap-3 border-b border-rule pb-2">
                <Link
                  href={`/admin/articles/${article.id}`}
                  className="line-clamp-1 font-sans text-[0.8rem] text-navy hover:text-gold-dark"
                >
                  {article.title}
                </Link>
                <span className="shrink-0 font-sans text-[0.58rem] uppercase tracking-[0.1em] text-ink-muted">
                  {article.status}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-2">
            <Link href="/admin/articles/new" className="btn-primary w-full">
              <FileText className="h-4 w-4" aria-hidden="true" /> New article
            </Link>
            <Link href="/admin/fact-checks" className="btn-outline w-full">
              Open fact-check desk
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
