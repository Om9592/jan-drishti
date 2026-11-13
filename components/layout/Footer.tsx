import Link from "next/link";
import { MastheadMark } from "@/components/ui/MastheadMark";
import { createTranslator, type Lang } from "@/lib/i18n";
import { capabilities } from "@/lib/config";

export function Footer({ lang }: { lang: Lang }) {
  const t = createTranslator(lang);
  const caps = capabilities();
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("footer.standards"),
      links: [
        { href: "/about", label: t("footer.about") },
        { href: "/editorial-policy", label: t("footer.policy") },
        { href: "/fact-checking-methodology", label: t("footer.methodology") },
        { href: "/corrections", label: t("footer.corrections") },
        { href: "/funding", label: t("footer.funding") },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { href: "/contact", label: t("footer.contact") },
        { href: "/submit", label: t("nav.submit") },
        { href: "/contribute", label: t("nav.writeForUs") },
        { href: "/latest", label: t("nav.latest") },
        { href: "/fact-check", label: t("nav.factCheck") },
        { href: "/states", label: t("nav.states") },
      ],
    },
    {
      title: lang === "hi" ? "कानूनी" : "Legal",
      links: [
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/terms", label: t("footer.terms") },
        { href: "/corrections", label: t("footer.corrections") },
        { href: "/contact", label: t("footer.contact") },
      ],
    },
  ];

  return (
    <footer className="mt-16 bg-navy text-paper">
      <div className="container-editorial py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-3 text-paper">
              <MastheadMark size={34} className="text-gold" />
              <div>
                <p className="font-serif text-[1.15rem] font-semibold tracking-[0.18em]">JAN DRISHTI</p>
                <p className="font-sans text-[0.6rem] uppercase tracking-[0.26em] text-paper/60">
                  {lang === "hi" ? "जन दृष्टि" : "See beyond headlines"}
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-sm font-sans text-[0.85rem] leading-relaxed text-paper/75">
              {t("footer.independence")}
            </p>
            <p className="mt-4 max-w-sm font-serif text-[0.9rem] italic leading-relaxed text-gold-light">
              {t("footer.aiNote")}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-paper/15 pt-4">
              <Link href="/fact-check" className="font-sans text-[0.68rem] uppercase tracking-[0.12em] text-paper/80 hover:text-gold">
                {t("nav.factCheck")}
              </Link>
              <Link href="/ground-reports" className="font-sans text-[0.68rem] uppercase tracking-[0.12em] text-paper/80 hover:text-gold">
                {t("nav.groundReports")}
              </Link>
              <Link href="/search" className="font-sans text-[0.68rem] uppercase tracking-[0.12em] text-paper/80 hover:text-gold">
                {t("search.title")}
              </Link>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="font-sans text-[0.65rem] uppercase tracking-[0.18em] text-gold">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="font-sans text-[0.83rem] text-paper/75 transition-colors hover:text-paper"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-paper/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-sans text-[0.7rem] uppercase tracking-[0.12em] text-paper/60">
              {t("footer.owner")}
            </p>
            <p className="font-sans text-[0.7rem] text-paper/50">
              © {year} Jan Drishti. {t("footer.rights")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-sans text-[0.62rem] uppercase tracking-[0.1em] text-paper/55">
            <span className={`inline-flex items-center gap-1.5`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${caps.database === "firestore" ? "bg-verdict-true" : "bg-gold"}`}
                aria-hidden="true"
              />
              {caps.database === "firestore" ? "Firestore connected" : "Sample data · Firestore not connected"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{caps.ai ? "AI research: configured" : "AI research: not configured"}</span>
            <span aria-hidden="true">·</span>
            <span>{caps.search ? "Evidence search: configured" : "Evidence search: not configured"}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
