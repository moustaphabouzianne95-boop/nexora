import type { NextConfig } from "next";

const securityHeaders = [
  // NOTE: X-Frame-Options is intentionally NOT set here so the app can be
  // embedded in the preview panel iframe (cross-origin framing is required
  // for the sandbox preview to work).
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // "standalone" is for the sandbox/Docker runtime only — Vercel handles
  // its own output and must not receive a standalone build.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Native / engine-backed packages must stay outside the bundler.
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql", "@prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
