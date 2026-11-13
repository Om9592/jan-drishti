import Link from "next/link";
import type { ReactNode } from "react";

export function PageShell({
  kicker,
  title,
  lede,
  children,
  updated,
  aside,
}: {
  kicker: string;
  title: string;
  lede?: string;
  children: ReactNode;
  updated?: string;
  aside?: { title: string; links: { href: string; label: string }[] };
}) {
  return (
    <div className="container-editorial py-9 sm:py-12">
      <div className={aside ? "grid gap-10 lg:grid-cols-12 lg:gap-12" : ""}>
        <div className={aside ? "lg:col-span-8" : "mx-auto max-w-3xl"}>
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-gold" aria-hidden="true" />
            <p className="kicker-gold">{kicker}</p>
          </div>
          <h1 className="mt-3 font-serif text-display-md font-semibold leading-[1.1] text-navy">{title}</h1>
          {lede && (
            <p className="mt-4 max-w-2xl font-serif text-[1.1rem] leading-relaxed text-ink-soft sm:text-[1.2rem]">
              {lede}
            </p>
          )}
          {updated && (
            <p className="mt-3 font-sans text-[0.65rem] uppercase tracking-[0.1em] text-ink-muted">{updated}</p>
          )}
          <div className="mt-7 border-t border-rule pt-7">{children}</div>
        </div>

        {aside && (
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-16">
              <div className="border border-rule bg-paper p-5">
                <p className="kicker">{aside.title}</p>
                <ul className="mt-3 space-y-2">
                  {aside.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="font-sans text-[0.82rem] text-ink-soft transition-colors hover:text-navy"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 border border-rule bg-white p-5">
                <p className="kicker-gold">Fact check</p>
                <p className="mt-1.5 font-serif text-[1rem] leading-snug text-navy">
                  Doubt something you were forwarded?
                </p>
                <Link
                  href="/submit"
                  className="mt-2.5 inline-block border-b border-gold pb-0.5 font-sans text-[0.64rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
                >
                  Send it for verification
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Editorial body copy styling for policy pages. */
export function PolicyProse({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-none space-y-6 font-sans text-[0.98rem] leading-[1.78] text-ink-soft [&_a]:text-navy [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-2 [&_h2]:mt-9 [&_h2]:font-serif [&_h2]:text-[1.4rem] [&_h2]:leading-snug [&_h2]:text-navy [&_h3]:mt-6 [&_h3]:font-serif [&_h3]:text-[1.12rem] [&_h3]:text-navy [&_li]:mb-1.5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
      {children}
    </div>
  );
}
