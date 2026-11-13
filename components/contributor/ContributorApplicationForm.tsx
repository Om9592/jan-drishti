"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";

type FieldErrors = Record<string, string>;

const BEAT_HINTS = [
  "Civic and municipal reporting",
  "Environment and climate",
  "Health and public hospitals",
  "Education and schools",
  "Caste, labour and migration",
  "Data, budgets and RTI",
  "Courts and policing",
  "Elections and governance",
];

export function ContributorApplicationForm() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setErrors({});
    setFormError(null);

    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      location: String(data.get("location") ?? ""),
      beats: String(data.get("beats") ?? ""),
      pitch: String(data.get("pitch") ?? ""),
      clips: String(data.get("clips") ?? ""),
      experience: String(data.get("experience") ?? "1-3"),
      consent: data.get("consent") === "on",
    };

    try {
      const res = await fetch("/api/contributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.fields ?? {});
        setFormError(json.error ?? "Could not send your application. Please try again.");
        return;
      }
      setReference(json.reference ?? "RECEIVED");
    } catch {
      setFormError("Network problem — your application was not sent.");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="border border-verdict-true/40 bg-verdict-true/[0.05] p-6">
        <CheckCircle2 className="h-6 w-6 text-verdict-true" aria-hidden="true" />
        <h2 className="mt-3 font-serif text-[1.35rem] font-semibold text-navy">Pitch received</h2>
        <p className="mt-2 font-sans text-[0.86rem] leading-relaxed text-ink-soft">
          Your reference is <strong className="font-mono text-ink">{reference}</strong>. An editor reads every pitch.
          If it fits the desk, you will get an invitation at the email address you gave — that mail lets you set your
          own password, and then your contributor desk opens.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="btn-outline">
            Back to the front page
          </Link>
          <Link href="/editorial-policy" className="btn-outline">
            Read our editorial policy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="field-label">
            Your name
          </label>
          <input id="name" name="name" required className="field" autoComplete="name" />
          {errors.name && <p className="mt-1 font-sans text-[0.72rem] text-verdict-false">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input id="email" name="email" type="email" required className="field" autoComplete="email" />
          {errors.email && <p className="mt-1 font-sans text-[0.72rem] text-verdict-false">{errors.email}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className="field-label">
            City or district (optional)
          </label>
          <input id="location" name="location" className="field" placeholder="e.g. Patna, Bihar" />
        </div>
        <div>
          <label htmlFor="experience" className="field-label">
            Reporting experience
          </label>
          <select id="experience" name="experience" className="field" defaultValue="1-3">
            <option value="student">Student / just starting</option>
            <option value="1-3">1–3 years</option>
            <option value="3-8">3–8 years</option>
            <option value="8+">8 years or more</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="beats" className="field-label">
          What do you report on?
        </label>
        <input
          id="beats"
          name="beats"
          required
          className="field"
          placeholder="e.g. municipal water supply, RTI, primary health centres"
          list="beat-hints"
        />
        <datalist id="beat-hints">
          {BEAT_HINTS.map((beat) => (
            <option key={beat} value={beat} />
          ))}
        </datalist>
        {errors.beats && <p className="mt-1 font-sans text-[0.72rem] text-verdict-false">{errors.beats}</p>}
      </div>

      <div>
        <label htmlFor="pitch" className="field-label">
          The story you want to report
        </label>
        <textarea
          id="pitch"
          name="pitch"
          required
          rows={7}
          className="field"
          placeholder="What is the story, who is affected, what have you already verified, and who have you spoken to? Be specific — vague pitches are hard to commission."
        />
        <p className="mt-1 font-sans text-[0.7rem] text-ink-muted">
          At least a paragraph. We are looking for reporting that stands up, not a press release.
        </p>
        {errors.pitch && <p className="mt-1 font-sans text-[0.72rem] text-verdict-false">{errors.pitch}</p>}
      </div>

      <div>
        <label htmlFor="clips" className="field-label">
          Links to published work (optional)
        </label>
        <textarea
          id="clips"
          name="clips"
          rows={2}
          className="field"
          placeholder="One link per line — your own bylined work only."
        />
      </div>

      <label className="flex items-start gap-2.5 border border-rule bg-paper-shade p-3 font-sans text-[0.78rem] leading-relaxed text-ink-soft">
        <input type="checkbox" name="consent" className="mt-0.5 h-3.5 w-3.5 accent-navy" />
        <span>
          This pitch and any samples are my own work. I have not copied anyone else&apos;s reporting, and I understand
          that everything I file is reviewed by an editor before it is published.
        </span>
      </label>
      {errors.consent && <p className="font-sans text-[0.72rem] text-verdict-false">{errors.consent}</p>}

      {formError && (
        <p role="alert" className="border border-verdict-false/30 bg-verdict-false/[0.05] px-3 py-2 font-sans text-[0.8rem] text-verdict-false">
          {formError}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Send the pitch
      </button>
      <p className="font-sans text-[0.7rem] leading-relaxed text-ink-muted">
        We keep your email only to reply about this pitch. See the{" "}
        <Link href="/privacy" className="underline decoration-rule underline-offset-2 hover:text-navy">
          privacy note
        </Link>
        .
      </p>
    </form>
  );
}
