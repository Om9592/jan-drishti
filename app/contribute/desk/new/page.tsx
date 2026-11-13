import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { getViewer, hasAtLeast } from "@/lib/security/auth";
import { ArticleEditor } from "@/components/admin/ArticleEditor";

export const metadata = { title: "New story", robots: { index: false, follow: false } };

export default async function NewContributorStoryPage() {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) redirect("/login?next=/contribute/desk/new");
  if (!hasAtLeast(viewer.role, "contributor") || viewer.role === "researcher") redirect("/contribute/desk");

  const categories = await getStore().listCategories();

  return (
    <div className="container-editorial py-8">
      <h1 className="font-serif text-[1.5rem] font-semibold text-navy">New story</h1>
      <p className="mt-1 max-w-2xl font-sans text-[0.78rem] leading-relaxed text-ink-muted">
        Write it as you would file it. Save a draft as often as you like; when it is ready, submit it to the desk and an
        editor will read it.
      </p>
      <div className="mt-5">
        <ArticleEditor categories={categories} mode="contributor" />
      </div>
    </div>
  );
}
