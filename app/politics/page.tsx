import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Politics & Governance",
  description: "Legislatures, elections, courts and accountability — without party colour.",
  alternates: { canonical: "/politics" },
};

export default async function PoliticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/politics"
      categorySlug="politics"
      kicker="Power, examined"
      title="Politics & Governance"
      description="We assess claims by the evidence, not by who made them. Every government statement we report is attributed; every denial we report is checked against the record."
      searchParams={await searchParams}
    />
  );
}
