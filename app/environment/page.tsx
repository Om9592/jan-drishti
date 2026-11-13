import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Environment",
  description: "Land, water, air and the people who depend on them. Every environmental claim here is traced to a document or a named source.",
  alternates: { canonical: "/environment" },
};

export default async function EnvironmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/environment"
      categorySlug="environment"
      kicker="Environment"
      title="Environment"
      description="Land, water, air and the people who depend on them. Every environmental claim here is traced to a document or a named source."
      searchParams={await searchParams}
    />
  );
}
