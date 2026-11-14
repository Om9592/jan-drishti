import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Latest News",
  description: "Everything Jan Drishti has published, newest first — reporting, explainers and ground reports.",
  alternates: { canonical: "/latest" },
};

export default async function LatestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/latest"
      kicker="Chronological file"
      title="Latest News"
      description="Every published story, newest first. Nothing here is aggregated without attribution, and nothing is published before an editor has signed it off."
      searchParams={await searchParams}
      includeWire
      emptyTitle="No editorial story is published yet"
      emptyBody="Our own reporting appears here only after an editor signs it off, so this file starts empty. The live headlines below come from named publishers and are linked to the original — and you can put any claim to the checker at Ask AI."
    />
  );
}
