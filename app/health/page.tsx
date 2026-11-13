import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Healthcare",
  description: "Hospitals, public health and access — with medical claims held to evidence.",
  alternates: { canonical: "/health" },
};

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/health"
      categorySlug="health"
      kicker="Care, and who gets it"
      title="Healthcare"
      description="Public health, hospitals and access to treatment. Health claims are checked against primary literature and official guidance, never against a single post."
      searchParams={await searchParams}
    />
  );
}
