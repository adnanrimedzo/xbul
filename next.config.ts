import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM via `new URL(..., import.meta.url)`, which breaks once bundled; keep both drivers external.
  // pg-cloudflare (pg's Workers socket) is listed so the OpenNext build copies its workerd entry, which Node tracing skips.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "pg-cloudflare"],
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
