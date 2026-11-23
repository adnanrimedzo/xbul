import type { NextConfig } from "next";

// The page paths without a language prefix: everything but /tr, /en, /api, Next's own files and files with an extension.
const LOCALE_ENTRY = ['/', '/:path((?!tr(?:/|$)|en(?:/|$)|api/|_next/|.*\\.[a-zA-Z0-9]+$).+)'];

const nextConfig: NextConfig = {
  // PGlite loads its WASM via `new URL(..., import.meta.url)`, which breaks once bundled; keep both drivers external.
  // pg-cloudflare (pg's Workers socket) is listed so the OpenNext build copies its workerd entry, which Node tracing skips.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "pg", "pg-cloudflare"],
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
  // Languages. English is served at the bare paths and Turkish under /tr; app/[lang] holds every page. This is config rather
  // than proxy.ts because OpenNext's support for Node proxies on Workers is experimental.
  async redirects() {
    return [
      // /en is the bare path, so there is one URL per page and language.
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
      // An explicit choice of Turkish (the switcher's cookie).
      ...LOCALE_ENTRY.map((source) => ({ source, destination: `/tr${source === '/' ? '' : '/:path'}`, permanent: false, has: [{ type: 'cookie' as const, key: 'lang', value: 'tr' }] })),
      // No choice yet, visiting from Türkiye (Cloudflare's country header): Turkish. Crawlers are left alone, so the English
      // pages stay indexable, and each page names its other language with hreflang.
      ...LOCALE_ENTRY.map((source) => ({
        source,
        destination: `/tr${source === '/' ? '' : '/:path'}`,
        permanent: false,
        has: [{ type: 'header' as const, key: 'cf-ipcountry', value: 'TR' }],
        missing: [
          { type: 'cookie' as const, key: 'lang' },
          { type: 'header' as const, key: 'user-agent', value: '.*(?:[Bb]ot|[Cc]rawl|[Ss]pider|[Ss]lurp|facebookexternalhit|Google-InspectionTool).*' },
        ],
      })),
    ];
  },
  async rewrites() {
    // Everything else is English, served from app/[lang] with lang = en.
    return { beforeFiles: LOCALE_ENTRY.map((source) => ({ source, destination: source === '/' ? '/en' : '/en/:path' })), afterFiles: [], fallback: [] };
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
