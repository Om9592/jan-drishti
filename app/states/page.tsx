import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "States",
  description: "Reporting from India's districts and states, filtered by state.",
  alternates: { canonical: "/states" },
};

export default async function StatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/states"
      categorySlug="states"
      showStateFilter
      kicker="From the districts"
      title="States"
      description="India is not one story. Filter reporting by state — every dispatch names the district, the date and the official it was checked with."
      searchParams={await searchParams}
    />
  );
}
