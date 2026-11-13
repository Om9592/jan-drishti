import { getStore } from "@/lib/store";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export default async function NewArticlePage() {
  const store = getStore();
  const categories = await store.listCategories();

  return (
    <div>
      <h2 className="font-serif text-[1.3rem] font-semibold text-navy">New article</h2>
      <p className="mt-1 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-muted">
        Label the provenance honestly. If the reporting is not ours, mark it as external-source reporting and attach
        the original link.
      </p>
      <div className="mt-5">
        <ArticleEditor categories={categories} />
      </div>
    </div>
  );
}
