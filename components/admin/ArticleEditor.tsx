"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Article, Category, SourceRef, SourceType } from "@/lib/types";

const KINDS = [
  { value: "original", label: "Original reporting" },
  { value: "summary", label: "News summary" },
  { value: "external", label: "External-source reporting" },
  { value: "opinion", label: "Opinion & analysis" },
  { value: "explainer", label: "Explainer" },
];

const STATUSES = ["draft", "review", "scheduled", "published", "archived"];

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "government", label: "Government statement" },
  { value: "primary_record", label: "Primary record" },
  { value: "independent_journalism", label: "Independent journalism" },
  { value: "research", label: "Research publication" },
  { value: "opinion", label: "Opinion" },
  { value: "social_media", label: "Social media" },
  { value: "other", label: "Other" },
];

const AUTHORS = [
  { id: "auth-desk", name: "Jan Drishti Editorial Desk" },
  { id: "auth-field", name: "Field Reporting Desk" },
  { id: "auth-research", name: "Research Desk" },
  { id: "auth-econ", name: "Economy Desk" },
  { id: "wire-desk", name: "Wire Desk" },
];

export function ArticleEditor({
  article,
  categories,
}: {
  article?: Article;
  categories: Category[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: article?.title ?? "",
    subtitle: article?.subtitle ?? "",
    summary: article?.summary ?? "",
    content: article?.content ?? "",
    language: article?.language ?? ("en" as "en" | "hi"),
    categoryId: article?.categoryId ?? categories[0]?.id ?? "",
    authorId: article?.authorId ?? "auth-desk",
    kind: article?.kind ?? ("original" as Article["kind"]),
    status: article?.status ?? ("draft" as Article["status"]),
    imageUrl: article?.imageUrl ?? "",
    imageCaption: article?.imageCaption ?? "",
    imageCredit: article?.imageCredit ?? "",
    state: article?.state ?? "",
    tags: (article?.tags ?? []).join(", "),
    featured: article?.featured ?? false,
    underreported: article?.underreported ?? false,
    groundReport: article?.groundReport ?? false,
  });
  const [sources, setSources] = useState<SourceRef[]>(
    article?.sources?.map((s) => ({ ...s })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addSource() {
    setSources((prev) => [
      ...prev,
      {
        id: `src-${Date.now()}`,
        name: "",
        url: "",
        publisher: "",
        type: "primary_record",
        accessedAt: new Date().toISOString(),
      },
    ]);
  }

  function updateSource(index: number, patch: Partial<SourceRef>) {
    setSources((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function save(status?: Article["status"]) {
    setBusy(true);
    setMessage(null);
    const payload = {
      id: article?.id,
      ...form,
      status: status ?? form.status,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      authorName: AUTHORS.find((a) => a.id === form.authorId)?.name,
      sources: sources.filter((s) => s.name && s.url),
    };
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        fields?: Record<string, string>;
        article?: { id: string; slug: string; status: string };
      };
      if (!res.ok || !data.ok) {
        setMessage({
          type: "error",
          text: `${data.error ?? "Save failed."} ${data.fields ? Object.values(data.fields).join(" ") : ""}`,
        });
        return;
      }
      setMessage({ type: "ok", text: `Saved as ${data.article?.status}.` });
      router.refresh();
      if (!article?.id && data.article?.id) router.push(`/admin/articles/${data.article.id}`);
    } catch {
      setMessage({ type: "error", text: "Request failed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <div>
          <label htmlFor="title" className="field-label">Headline</label>
          <input
            id="title"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="field font-serif text-[1.1rem]"
            placeholder="The headline readers will see"
          />
        </div>
        <div>
          <label htmlFor="subtitle" className="field-label">Standfirst</label>
          <input
            id="subtitle"
            value={form.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="summary" className="field-label">Summary (used in cards and search)</label>
          <textarea
            id="summary"
            rows={3}
            value={form.summary}
            onChange={(e) => update("summary", e.target.value)}
            className="field resize-y"
          />
        </div>
        <div>
          <label htmlFor="content" className="field-label">Body (HTML: p, h2, h3, ul, ol, blockquote, a, strong)</label>
          <textarea
            id="content"
            rows={16}
            value={form.content}
            onChange={(e) => update("content", e.target.value)}
            className="field resize-y font-mono text-[0.8rem]"
            placeholder="<p>First paragraph…</p>"
          />
          <p className="mt-1 font-sans text-[0.68rem] text-ink-muted">
            Content is sanitised server-side; scripts and inline event handlers are stripped.
          </p>
        </div>

        <div className="border border-rule p-3">
          <div className="flex items-center justify-between">
            <p className="font-sans text-[0.68rem] uppercase tracking-[0.1em] text-ink-muted">Sources</p>
            <button type="button" onClick={addSource} className="btn-ghost border border-rule">
              <Plus className="h-3 w-3" aria-hidden="true" /> Add source
            </button>
          </div>
          {sources.length === 0 && (
            <p className="mt-2 font-sans text-[0.75rem] text-ink-muted">
              No sources attached. A published story without a source is a rumour.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {sources.map((source, index) => (
              <li key={source.id} className="grid gap-2 border border-rule p-2 sm:grid-cols-2">
                <input
                  value={source.name}
                  onChange={(e) => updateSource(index, { name: e.target.value })}
                  placeholder="Source title"
                  className="field text-[0.8rem]"
                  aria-label="Source title"
                />
                <input
                  value={source.url}
                  onChange={(e) => updateSource(index, { url: e.target.value })}
                  placeholder="https://…"
                  className="field text-[0.8rem]"
                  aria-label="Source URL"
                />
                <input
                  value={source.publisher ?? ""}
                  onChange={(e) => updateSource(index, { publisher: e.target.value })}
                  placeholder="Publisher"
                  className="field text-[0.8rem]"
                  aria-label="Publisher"
                />
                <div className="flex gap-2">
                  <select
                    value={source.type}
                    onChange={(e) => updateSource(index, { type: e.target.value as SourceType })}
                    className="field text-[0.8rem]"
                    aria-label="Source type"
                  >
                    {SOURCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSources((prev) => prev.filter((_, i) => i !== index))}
                    className="shrink-0 border border-rule px-2 text-ink-muted hover:border-verdict-false hover:text-verdict-false"
                    aria-label="Remove source"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="space-y-4 lg:col-span-4">
        <div className="border border-rule bg-white p-4">
          <p className="font-sans text-[0.68rem] uppercase tracking-[0.1em] text-ink-muted">Publication</p>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="status" className="field-label">Status</label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => update("status", e.target.value as Article["status"])}
                className="field"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="category" className="field-label">Section</label>
              <select
                id="category"
                value={form.categoryId}
                onChange={(e) => update("categoryId", e.target.value)}
                className="field"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.nameEn}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="kind" className="field-label">Provenance</label>
              <select
                id="kind"
                value={form.kind}
                onChange={(e) => update("kind", e.target.value as Article["kind"])}
                className="field"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="language" className="field-label">Language</label>
              <select
                id="language"
                value={form.language}
                onChange={(e) => update("language", e.target.value as "en" | "hi")}
                className="field"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
            <div>
              <label htmlFor="author" className="field-label">Byline</label>
              <select
                id="author"
                value={form.authorId}
                onChange={(e) => update("authorId", e.target.value)}
                className="field"
              >
                {AUTHORS.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="state" className="field-label">State (optional)</label>
              <input
                id="state"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="tags" className="field-label">Tags (comma separated)</label>
              <input
                id="tags"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                className="field"
              />
            </div>
          </div>
        </div>

        <div className="border border-rule bg-white p-4">
          <p className="font-sans text-[0.68rem] uppercase tracking-[0.1em] text-ink-muted">Presentation</p>
          <div className="mt-3 space-y-2.5">
            <div>
              <label htmlFor="imageUrl" className="field-label">Image URL</label>
              <input
                id="imageUrl"
                value={form.imageUrl}
                onChange={(e) => update("imageUrl", e.target.value)}
                className="field text-[0.8rem]"
                placeholder="/images/… or Firebase Storage URL"
              />
            </div>
            <input
              value={form.imageCaption}
              onChange={(e) => update("imageCaption", e.target.value)}
              placeholder="Caption"
              className="field text-[0.8rem]"
              aria-label="Image caption"
            />
            <input
              value={form.imageCredit}
              onChange={(e) => update("imageCredit", e.target.value)}
              placeholder="Credit"
              className="field text-[0.8rem]"
              aria-label="Image credit"
            />
            <label className="flex items-center gap-2 font-sans text-[0.78rem] text-ink-soft">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => update("featured", e.target.checked)}
                className="h-3.5 w-3.5 accent-navy"
              />
              Feature on the homepage
            </label>
            <label className="flex items-center gap-2 font-sans text-[0.78rem] text-ink-soft">
              <input
                type="checkbox"
                checked={form.underreported}
                onChange={(e) => update("underreported", e.target.checked)}
                className="h-3.5 w-3.5 accent-navy"
              />
              Underreported India
            </label>
            <label className="flex items-center gap-2 font-sans text-[0.78rem] text-ink-soft">
              <input
                type="checkbox"
                checked={form.groundReport}
                onChange={(e) => update("groundReport", e.target.checked)}
                className="h-3.5 w-3.5 accent-navy"
              />
              Ground report
            </label>
          </div>
        </div>

        {message && (
          <p
            role="status"
            className={`border px-3 py-2 font-sans text-[0.78rem] ${
              message.type === "ok"
                ? "border-verdict-true/30 bg-verdict-true/[0.05] text-verdict-true"
                : "border-verdict-false/30 bg-verdict-false/[0.05] text-verdict-false"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="grid gap-2">
          <button type="button" onClick={() => save("published")} disabled={busy} className="btn-primary">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Publish
          </button>
          <button type="button" onClick={() => save("draft")} disabled={busy} className="btn-outline">
            Save draft
          </button>
          {article && (
            <a
              href={`/article/${article.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-center font-sans text-[0.68rem] underline decoration-gold underline-offset-2"
            >
              View public page
            </a>
          )}
        </div>
      </aside>
    </div>
  );
}
