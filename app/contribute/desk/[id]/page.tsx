import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { getViewer, hasAtLeast } from "@/lib/security/auth";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Edit story", robots: { index: false, follow: false } };

export default async function ContributorStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer || viewer.demo) redirect(`/login?next=/contribute/desk/${id}`);

  const store = getStore();
  const [article, categories] = await Promise.all([store.getArticleById(id), store.listCategories()]);
  if (!article) notFound();

  const isStaff = viewer.role === "editor" || viewer.role === "admin";
  if (article.authorId !== viewer.uid && !isStaff) {
    return (
      <div className="container-editorial py-16">
        <div className="mx-auto max-w-lg border border-rule bg-white p-7 text-center">
          <h1 className="font-serif text-[1.4rem] text-navy">This story belongs to another contributor</h1>
          <p className="mt-2 font-sans text-[0.85rem] leading-relaxed text-ink-soft">
            Contributions are private to their author until an editor opens them for review.
          </p>
          <Link href="/contribute/desk" className="btn-outline mt-4 w-full">
            Back to my desk
          </Link>
        </div>
      </div>
    );
  }
  if (!isStaff && !hasAtLeast(viewer.role, "contributor")) redirect("/contribute");

  return (
    <div className="container-editorial py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker-gold">Contributor desk</p>
          <h1 className="mt-1 font-serif text-[1.45rem] font-semibold text-navy">Edit story</h1>
          <p className="mt-1 font-sans text-[0.72rem] text-ink-muted">
            Status {article.status} · last saved {formatDateTime(article.updatedAt)}
            {article.status === "published" && (
              <>
                {" · "}
                <Link href={`/article/${article.slug}`} className="underline decoration-rule underline-offset-2">
                  view live
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href="/contribute/desk" className="btn-outline">
          Back to my desk
        </Link>
      </div>
      <div className="mt-5">
        <ArticleEditor article={article} categories={categories} mode={isStaff ? "editor" : "contributor"} />
      </div>
    </div>
  );
}
