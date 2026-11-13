import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Ground Reports",
  description: "Original reporting from the field, with method notes and datelines attached.",
  alternates: { canonical: "/ground-reports" },
};

export default async function GroundReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/ground-reports"
      categorySlug="ground-reports"
      kicker="Original reporting"
      title="Ground Reports"
      description="A reporter was there. These pieces carry a dateline, a method note and the documents collected on the ground — the most expensive journalism we do, and the first thing budget cuts target."
      searchParams={await searchParams}
    />
  );
}
