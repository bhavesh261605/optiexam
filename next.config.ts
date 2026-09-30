import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  env: { NEXT_PUBLIC_HOSTED: process.env.VERCEL ? "true" : "false" },
  serverExternalPackages: ["node:sqlite"],
};
export default config;
