"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { AlertTriangle, Loader2 } from "lucide-react";
import { clientAuth, firebaseClientReady } from "@/lib/firebase/client";
import { useLanguage } from "@/components/providers/LanguageProvider";
import Link from "next/link";

type Mode = "signin" | "signup";

export function AuthForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/profile";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ready = firebaseClientReady();

  async function establishSession(user: import("firebase/auth").User) {
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Could not create a session on the server.");
    }
    router.push(nextPath);
    router.refresh();
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.error");
      setError(message.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  function readableAuthError(code: string): string {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Email or password is incorrect.";
      case "auth/email-already-in-use":
        return "An account already exists for this email. Sign in instead.";
      case "auth/weak-password":
        return "Choose a password with at least 8 characters.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a few minutes and try again.";
      case "auth/popup-closed-by-user":
        return "Google sign-in was closed before it finished.";
      default:
        return "Sign-in failed. Please try again.";
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    await withBusy(async () => {
      try {
        if (mode === "signup") {
          const cred = await createUserWithEmailAndPassword(clientAuth(), email, password);
          if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
          await establishSession(cred.user);
        } else {
          const cred = await signInWithEmailAndPassword(clientAuth(), email, password);
          await establishSession(cred.user);
        }
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        throw new Error(code ? readableAuthError(code) : t("auth.error"));
      }
    });
  }

  async function google() {
    if (!ready) return;
    await withBusy(async () => {
      try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(clientAuth(), provider);
        await establishSession(cred.user);
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        throw new Error(code ? readableAuthError(code) : t("auth.error"));
      }
    });
  }

  async function reset() {
    if (!ready || !email) {
      setError("Enter your email address first, then choose ‘Forgot password’.");
      return;
    }
    await withBusy(async () => {
      try {
        await sendPasswordResetEmail(clientAuth(), email);
        setNotice(t("auth.resetSent"));
      } catch {
        throw new Error("Could not send a reset email. Check the address and try again.");
      }
    });
  }

  if (!ready) {
    return (
      <div className="border border-rule bg-paper p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gold-dark" aria-hidden="true" />
          <h2 className="font-serif text-[1.15rem] text-navy">{t("auth.notConfigured")}</h2>
        </div>
        <p className="mt-2 font-sans text-[0.85rem] leading-relaxed text-ink-soft">{t("auth.notConfiguredBody")}</p>
        <ol className="mt-4 space-y-1.5 font-sans text-[0.78rem] text-ink-muted">
          <li>1. Create a Firebase project and enable Email/Password + Google sign-in.</li>
          <li>2. Add the NEXT_PUBLIC_FIREBASE_* variables in Vercel.</li>
          <li>3. Add server credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).</li>
          <li>4. Authorise your deployment domain under Authentication → Settings → Authorized domains.</li>
        </ol>
        <p className="mt-4 font-sans text-[0.78rem] leading-relaxed text-ink-muted">
          Until then, you can still <Link href="/submit" className="text-navy underline decoration-gold underline-offset-2">submit a claim</Link>{" "}
          or <Link href="/admin" className="text-navy underline decoration-gold underline-offset-2">preview the editorial desk</Link>{" "}
          in demo mode.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-rule bg-white p-5 sm:p-6">
      <div className="flex border-b border-rule">
        {(
          [
            ["signin", t("auth.signIn")],
            ["signup", t("auth.signUp")],
          ] as [Mode, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-selected={mode === value}
            className={`-mb-px border-b-2 px-4 py-2.5 font-sans text-[0.7rem] uppercase tracking-[0.1em] ${
              mode === value ? "border-gold text-navy" : "border-transparent text-ink-muted hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="field-label">
              {t("common.name")}
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="field-label">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        {error && (
          <p role="alert" className="border border-verdict-false/30 bg-verdict-false/[0.05] px-3 py-2 font-sans text-[0.78rem] text-verdict-false">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="border border-verdict-true/30 bg-verdict-true/[0.05] px-3 py-2 font-sans text-[0.78rem] text-verdict-true">
            {notice}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" aria-hidden="true" />
        <span className="font-sans text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted">or</span>
        <span className="h-px flex-1 bg-rule" aria-hidden="true" />
      </div>

      <button type="button" onClick={google} disabled={busy} className="btn-outline w-full">
        {t("auth.google")}
      </button>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={reset}
          className="font-sans text-[0.72rem] text-ink-muted hover:text-navy"
        >
          {t("auth.reset")}
        </button>
        <Link href="/submit" className="font-sans text-[0.72rem] text-ink-muted hover:text-navy">
          {t("nav.submit")}
        </Link>
      </div>
    </div>
  );
}
