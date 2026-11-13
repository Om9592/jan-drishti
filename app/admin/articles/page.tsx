import Link from "next/link";
import { Plus } from "lucide-react";
import { getStore } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export default async function AdminArticlesPage() {
  const store = getStore();
  const result = await store.listArticles({ status: "all", limit: 100, sort: "latest" });

  const groups: { label: string; statuses: string[] }[] = [
    { label: "Published", statuses: ["published"] },
    { label: "In review / scheduled", statuses: ["review", "scheduled"] },
    { label: "Drafts", statuses: ["draft"] },
    { label: "Archived", statuses: ["archived"] },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Articles</h2>
          <p className="mt-1 font-sans text-[0.78rem] text-ink-muted">
            {result.total} items · publishing requires an editor or admin role
          </p>
        </div>
        <Link href="/admin/articles/new" className="btn-primary">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New article
        </Link>
      </div>

      <div className="mt-6 space-y-8">
        {groups.map((group) => {
          const items = result.items.filter((a) => group.statuses.includes(a.status));
          if (items.length === 0) return null;
          return (
            <section key={group.label}>
              <h3 className="border-b border-rule pb-2 font-sans text-[0.65rem] uppercase tracking-[0.14em] text-ink-muted">
                {group.label} · {items.length}
              </h3>
              <ul className="divide-y divide-rule">
                {items.map((article) => (
                  <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/articles/${article.id}`}
                        className="line-clamp-1 font-serif text-[0.98rem] text-navy hover:text-gold-dark"
                      >
                        {article.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-sans text-[0.62rem] text-ink-muted">
                        <span className="uppercase tracking-[0.08em]">{article.kind}</span>
                        <span aria-hidden="true">·</span>
                        <span>{article.categorySlug ?? "—"}</span>
                        <span aria-hidden="true">·</span>
                        <span>{article.language.toUpperCase()}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDateTime(article.updatedAt)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="border border-rule px-1.5 py-0.5 font-sans text-[0.56rem] uppercase tracking-[0.1em] text-ink-muted">
                        {article.status}
                      </span>
                      <Link
                        href={`/admin/articles/${article.id}`}
                        className="border border-navy px-2.5 py-1 font-sans text-[0.58rem] uppercase tracking-[0.1em] text-navy hover:bg-navy hover:text-paper"
                      >
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {result.items.length === 0 && (
          <p className="border border-dashed border-rule-strong bg-paper-warm/40 px-4 py-8 text-center font-sans text-[0.85rem] text-ink-muted">
            No articles yet. Create one, or enable a feed in Sources &amp; sections.
          </p>
        )}
      </div>
    </div>
  );
}
