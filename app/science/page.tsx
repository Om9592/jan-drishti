import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Science",
  description: "Indian research, space, health science and the lab work that rarely reaches a front page — reported plainly, with the paper linked.",
  alternates: { canonical: "/science" },
};

export default async function SciencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/science"
      categorySlug="science"
      kicker="Science"
      title="Science"
      description="Indian research, space, health science and the lab work that rarely reaches a front page — reported plainly, with the paper linked."
      searchParams={await searchParams}
    />
  );
}
