"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Clears the server-side session cookie and returns the reader to the front page.
 * Rendered only for genuinely authenticated viewers.
 */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", { method: "DELETE" });
      if (!res.ok) throw new Error("Sign-out failed");
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={signOut} disabled={busy} className="btn-ghost" aria-busy={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <LogOut size={14} aria-hidden="true" />}
        {compact ? null : t("auth.signOut")}
      </button>
      {error && (
        <span role="alert" className="font-sans text-[0.7rem] text-verdict-false">
          {error}
        </span>
      )}
    </div>
  );
}
