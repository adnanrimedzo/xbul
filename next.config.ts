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
