/**
 * Jan Drishti mark: an eye within a broken square — "drishti" (sight) bounded
 * by a frame that never quite closes, i.e. a view that keeps questioning itself.
 */
export function MastheadMark({ className = "", size = 44 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Jan Drishti"
      className={className}
      fill="none"
    >
      <rect x="1" y="1" width="46" height="46" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      <path d="M4 4h30" stroke="currentColor" strokeWidth="2" />
      <path d="M4 4v30" stroke="currentColor" strokeWidth="2" />
      <path d="M44 14v30H14" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9 24c4.2-6.4 9.2-9.6 15-9.6S34.8 17.6 39 24c-4.2 6.4-9.2 9.6-15 9.6S13.2 30.4 9 24Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="24" cy="24" r="4.1" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="24" cy="24" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <MastheadMark className="text-gold" size={compact ? 30 : 40} />
      <span className="flex flex-col">
        <span
          className={
            compact
              ? "whitespace-nowrap font-serif text-[1.15rem] font-semibold leading-none tracking-[0.18em] text-navy"
              : "whitespace-nowrap font-serif text-[1.28rem] font-semibold leading-none tracking-[0.13em] text-navy sm:text-[1.85rem] sm:tracking-[0.18em] lg:text-[2.1rem]"
          }
        >
          JAN DRISHTI
        </span>
        <span
          className={
            compact
              ? "mt-1 font-sans text-[0.5rem] uppercase tracking-[0.28em] text-ink-muted"
              : "mt-1.5 whitespace-nowrap font-sans text-[0.5rem] uppercase tracking-[0.2em] text-ink-muted sm:text-[0.58rem] sm:tracking-[0.28em]"
          }
        >
          <span className="font-sans-hi normal-case tracking-normal">जन दृष्टि</span>
          <span className="mx-1.5 text-gold">·</span>
          <span className="hidden sm:inline">See beyond headlines</span>
          <span className="sm:hidden">See beyond headlines</span>
        </span>
      </span>
    </span>
  );
}
