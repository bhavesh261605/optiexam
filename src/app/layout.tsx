import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language";
import "./globals.css";
import "./workspace.css";
import "./learning-navigation.css";
import "./audio.css";
export const metadata: Metadata = {
  title: "OptiExam · Accessible examinations",
  icons: { icon: "/optiexam-symbol.png", apple: "/optiexam-symbol.png" },
  description: "An accessible examination and practice workspace.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
