import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const [article, categories] = await Promise.all([store.getArticleById(id), store.listCategories()]);
  if (!article) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.3rem] font-semibold text-navy">Edit article</h2>
          <p className="mt-1 font-sans text-[0.72rem] text-ink-muted">
            Slug: /article/{article.slug} · status {article.status}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <ArticleEditor article={article} categories={categories} />
      </div>
    </div>
  );
}
