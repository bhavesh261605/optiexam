import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
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
      <body>{children}</body>
    </html>
  );
}
