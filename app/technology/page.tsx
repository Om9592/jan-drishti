import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Technology",
  description: "What India's technology policy, platforms and chips actually do to ordinary users — and who profits.",
  alternates: { canonical: "/technology" },
};

export default async function TechnologyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/technology"
      categorySlug="technology"
      kicker="Technology"
      title="Technology"
      description="What India's technology policy, platforms and chips actually do to ordinary users — and who profits."
      searchParams={await searchParams}
    />
  );
}
