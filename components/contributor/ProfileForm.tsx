"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRound } from "lucide-react";
import type { EditorialUser } from "@/lib/types";

export function ContributorProfileForm({ profile }: { profile: EditorialUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const res = await fetch("/api/contributors/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          beats: String(data.get("beats") ?? ""),
          location: String(data.get("location") ?? ""),
          bio: String(data.get("bio") ?? ""),
          avatarUrl: String(data.get("avatarUrl") ?? ""),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.fields ?? {});
        setMessage({ ok: false, text: json.error ?? "Could not save your profile." });
        return;
      }
      setMessage({ ok: true, text: "Profile saved. It appears on the site once your first story is published." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network error — nothing was saved." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-rule bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-navy" aria-hidden="true" />
          <span>
            <span className="block font-serif text-[1.02rem] text-navy">My public profile</span>
            <span className="mt-0.5 block font-sans text-[0.72rem] text-ink-muted">
              {profile.slug ? `/contributors/${profile.slug}` : "created when you set it up"} · name, beat, bio, photo
            </span>
          </span>
        </span>
        <span className="font-sans text-[0.6rem] uppercase tracking-[0.1em] text-ink-muted">
          {open ? "Close" : "Edit"}
        </span>
      </button>

      {open && (
        <form onSubmit={save} className="space-y-3 border-t border-rule px-4 py-4" noValidate>
          <p className="font-sans text-[0.75rem] leading-relaxed text-ink-muted">
            This is what readers see on your byline page. Keep the beat specific — it is how editors and readers find
            you.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-name" className="field-label">
                Name you publish under
              </label>
              <input id="profile-name" name="name" defaultValue={profile.name} required className="field" />
              {errors.name && <p className="mt-1 font-sans text-[0.72rem] text-verdict-false">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="profile-location" className="field-label">
                City or district
              </label>
              <input id="profile-location" name="location" defaultValue={profile.location ?? ""} className="field" />
            </div>
          </div>
          <div>
            <label htmlFor="profile-beats" className="field-label">
              Beat
            </label>
            <input
              id="profile-beats"
              name="beats"
              defaultValue={profile.beats ?? ""}
              className="field"
              placeholder="Public health, RTI, municipal water supply"
            />
          </div>
          <div>
            <label htmlFor="profile-bio" className="field-label">
              Short bio
            </label>
            <textarea
              id="profile-bio"
              name="bio"
              rows={4}
              defaultValue={profile.bio ?? ""}
              className="field"
              placeholder="Two or three sentences: where you report from, what you cover, what you have published."
            />
          </div>
          <div>
            <label htmlFor="profile-avatar" className="field-label">
              Photo URL (optional)
            </label>
            <input
              id="profile-avatar"
              name="avatarUrl"
              defaultValue={profile.avatarUrl ?? ""}
              className="field"
              placeholder="https://…"
            />
            {errors.avatarUrl && <p className="mt-1 font-sans text-[0.72rem] text-verdict-false">{errors.avatarUrl}</p>}
          </div>

          {message && (
            <p
              role="status"
              className={`border px-3 py-2 font-sans text-[0.78rem] ${
                message.ok
                  ? "border-verdict-true/30 bg-verdict-true/[0.05] text-verdict-true"
                  : "border-verdict-false/30 bg-verdict-false/[0.05] text-verdict-false"
              }`}
            >
              {message.text}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Save profile
          </button>
        </form>
      )}
    </div>
  );
}
