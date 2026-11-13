import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "India",
  description: "Policy, institutions and the everyday state — reported with documents attached.",
  alternates: { canonical: "/india" },
};

export default async function IndiaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/india"
      categorySlug="india"
      kicker="The Republic, reported"
      title="India"
      description="Policy, institutions and the everyday state. We cover what changes in people's lives, and we cite the order that changed it."
      searchParams={await searchParams}
    />
  );
}
