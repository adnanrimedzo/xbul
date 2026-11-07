import { readConfig } from '@/server/config';

export const dynamic = 'force-dynamic';

// Search and AI crawlers alike may read the public pages in both languages; the signed-in tools stay out.
const PRIVATE = ['/admin/', '/add', '/api/', '/verify/', '/onboarding', '/sign-in'];
const PRODUCTION = `User-agent: *
Allow: /
${PRIVATE.flatMap((p) => [`Disallow: ${p}`, `Disallow: /tr${p}`]).join('\n')}

Sitemap: https://xbul.io/sitemap.xml
`;

const EVERYWHERE_ELSE = `User-agent: *
Disallow: /
`;

// A route, not robots.ts: that is generated at build time, when the Worker has no PUBLIC_BASE_URL, and this differs per environment.
export async function GET(): Promise<Response> {
  const body = readConfig().baseUrl === 'https://xbul.io' ? PRODUCTION : EVERYWHERE_ELSE;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
