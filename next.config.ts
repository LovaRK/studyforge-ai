import type { NextConfig } from "next";

// Every page is per-request and private, so Cache Components stays off:
// nothing here benefits from a prerendered static shell.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // pdf.js loads a worker file at runtime, so it must not be bundled.
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    // Uploads are capped at 10 MB in the app; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "11mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
