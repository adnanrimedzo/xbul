import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM via `new URL(..., import.meta.url)`, which breaks once bundled; keep both drivers external.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
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
