import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM via `new URL(..., import.meta.url)`, which breaks once bundled; keep both drivers external.
  // pg-cloudflare (pg's Workers socket) is listed so the OpenNext build copies its workerd entry, which Node tracing skips.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "pg-cloudflare"],
  // No page may be framed (clickjacking): X-Frame-Options for old browsers, frame-ancestors for the rest.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
  // Evidence files upload one per action call, up to 10 MB each (MAX_EVIDENCE_BYTES). The limit covers the whole
  // multipart body, so 11 MB leaves room for its overhead.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
