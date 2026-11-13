import type { Metadata } from "next";
import { SectionPage } from "@/components/pages/SectionPage";

export const metadata: Metadata = {
  title: "Education",
  description: "Schools, universities and learning outcomes — from admissions to classrooms.",
  alternates: { canonical: "/education" },
};

export default async function EducationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <SectionPage
      basePath="/education"
      categorySlug="education"
      kicker="Classrooms and campuses"
      title="Education"
      description="Admissions, examinations, teachers and learning outcomes. Circulars are cited by number and date — not summarised from a forwarded message."
      searchParams={await searchParams}
    />
  );
}
