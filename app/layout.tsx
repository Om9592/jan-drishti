import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, Noto_Sans_Devanagari, Noto_Serif_Devanagari } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SampleBanner } from "@/components/layout/SampleBanner";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { createTranslator, normaliseLang, LANGUAGE_COOKIE } from "@/lib/i18n";
import { config } from "@/lib/config";
import { getStore } from "@/lib/store";
import { getViewer } from "@/lib/security/auth";

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const serifHi = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-serif-hi",
});

const sansHi = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-sans-hi",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: "Jan Drishti — India, Without the Noise",
    template: "%s | Jan Drishti",
  },
  description:
    "Independent Indian journalism and AI-assisted fact-checking. Important stories, verified information, and the evidence behind every headline.",
  applicationName: "Jan Drishti",
  authors: [{ name: "Jan Drishti Editorial Desk", url: config.siteUrl }],
  keywords: [
    "India news",
    "fact check India",
    "independent journalism",
    "viral claim verification",
    "Hindi news",
    "ground reports",
  ],
  openGraph: {
    type: "website",
    locale: "en_IN",
    alternateLocale: ["hi_IN"],
    siteName: "Jan Drishti",
    title: "Jan Drishti — India, Without the Noise",
    description:
      "Important stories. Verified information. Evidence behind every headline.",
    url: config.siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Jan Drishti — India, Without the Noise",
    description: "Important stories. Verified information. Evidence behind every headline.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    canonical: "/",
    languages: { en: "/", hi: "/" },
  },
  category: "news",
};

export const viewport: Viewport = {
  themeColor: "#172B42",
  width: "device-width",
  initialScale: 1,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const lang = normaliseLang(cookieStore.get(LANGUAGE_COOKIE)?.value);
  const t = createTranslator(lang);

  const store = getStore();
  const [categories, latest, viewer] = await Promise.all([
    store.listCategories(),
    store.listArticles({ status: "published", limit: 1, sort: "latest" }),
    getViewer(),
  ]);

  const navCategories = categories
    .filter((c) => c.slug !== "fact-check")
    .map((c) => ({ slug: c.slug, label: lang === "hi" ? c.nameHi : c.nameEn }));

  const latestArticle = latest.items[0];

  return (
    <html lang={lang} className={`${serif.variable} ${sans.variable} ${serifHi.variable} ${sansHi.variable}`}>
      <body className={lang === "hi" ? "lang-hi" : ""}>
        <LanguageProvider lang={lang}>
          <SampleBanner lang={lang} />
          <Header
            categories={navCategories}
            latestHeadline={latestArticle ? { title: latestArticle.title, slug: latestArticle.slug } : null}
            viewer={viewer}
          />
          <main id="main" className="min-h-[50vh]">
            {children}
          </main>
          <Footer lang={lang} />
          <span className="sr-only">{t("brand.mission")}</span>
        </LanguageProvider>
      </body>
    </html>
  );
}
