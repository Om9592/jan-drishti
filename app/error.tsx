"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error", error);
  }, [error]);

  return (
    <div className="container-editorial py-20">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-gold-dark">Error</p>
        <h1 className="mt-3 font-serif text-display-md font-semibold text-navy">
          Something went wrong at our end
        </h1>
        <p className="mt-3 font-sans text-[0.9rem] leading-relaxed text-ink-soft">
          The page failed to load. This is our fault, not yours. The error has been logged.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-outline">
            Go to the homepage
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-[0.68rem] text-ink-muted">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
