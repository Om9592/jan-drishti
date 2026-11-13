"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Role } from "@/lib/types";

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/admin", label: t("admin.overview") },
    { href: "/admin/submissions", label: t("admin.submissions") },
    { href: "/admin/fact-checks", label: t("admin.factChecks") },
    { href: "/admin/articles", label: t("admin.articles") },
    { href: "/admin/contributors", label: t("admin.contributors") },
    { href: "/admin/corrections", label: t("admin.corrections") },
    { href: "/admin/taxonomy", label: t("admin.taxonomy") },
    ...(role === "admin" ? [{ href: "/admin/users", label: t("admin.users") }] : []),
    { href: "/admin/audit", label: t("admin.audit") },
  ];

  return (
    <nav aria-label="Editorial sections" className="mt-4 border-b border-rule">
      <ul className="no-scrollbar flex overflow-x-auto">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-3.5 py-2.5 font-sans text-[0.7rem] uppercase tracking-[0.1em] transition-colors",
                  active ? "border-gold text-navy" : "border-transparent text-ink-muted hover:text-navy",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
