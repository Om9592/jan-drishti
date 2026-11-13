import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Economy & Employment",
  description: "Work, wages, prices and public finance — with the survey notes attached.",
  alternates: { canonical: "/economy" },
};

export default async function EconomyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/economy"
      categorySlug="economy"
      kicker="Numbers, read carefully"
      title="Economy & Employment"
      description="Jobs, wages, prices and public finance. We name the dataset behind every figure, and we say when the data cannot support the headline."
      searchParams={await searchParams}
    />
  );
}
