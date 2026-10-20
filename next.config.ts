import type { NextConfig } from "next";

// CAP_BUILD=1 creates a static export for the Android Capacitor WebView.
// Web builds use standalone output. TypeScript errors must fail CI rather than
// being hidden behind a successful production build.
const isCap = process.env.CAP_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isCap
    ? { output: "export" as const, trailingSlash: true }
    : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

export default nextConfig;
