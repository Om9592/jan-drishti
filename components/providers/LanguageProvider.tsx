"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Lang, type Translator } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  t: Translator;
  isHindi: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo<LanguageContextValue>(
    () => ({ lang, t: createTranslator(lang), isHindi: lang === "hi" }),
    [lang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Sensible fallback so a component can never crash the page.
    return { lang: "en", t: createTranslator("en"), isHindi: false };
  }
  return ctx;
}
