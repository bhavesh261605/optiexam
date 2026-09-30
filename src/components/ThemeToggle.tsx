"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./language";
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const { language } = useLanguage();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("optiexam-theme");
    } catch {}
    const value = saved
      ? saved === "dark"
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDark(Boolean(value));
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);
  return (
    <button
      data-voice-action="theme"
      role="switch"
      aria-checked={dark}
      aria-label={language === "hi" ? "डार्क मोड" : "Dark mode"}
      onClick={() => {
        const value = !dark;
        setDark(value);
        document.documentElement.dataset.theme = value ? "dark" : "light";
        try {
          localStorage.setItem("optiexam-theme", value ? "dark" : "light");
        } catch {}
      }}
    >
      {language === "hi"
        ? dark
          ? "डार्क मोड"
          : "लाइट मोड"
        : dark
          ? "Dark mode"
          : "Light mode"}
    </button>
  );
}
