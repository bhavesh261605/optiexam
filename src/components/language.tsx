"use client";
import { stopReading } from "@/lib/page-reader";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { translate, type Language } from "@/lib/i18n";

const LanguageContext = createContext({
  language: "en" as Language,
  setLanguage: (_language: Language) => {},
  t: <T,>(value: T): T => value,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const t = useCallback(
    <T,>(value: T): T =>
      typeof value === "string" ? (translate(value, language) as T) : value,
    [language],
  );
  useEffect(() => {
    document.documentElement.lang = language;
    stopReading();
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
