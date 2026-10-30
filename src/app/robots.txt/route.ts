import { readConfig } from '@/server/config';

export const dynamic = 'force-dynamic';

const PRODUCTION = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /add
Disallow: /api/
Disallow: /verify/
Disallow: /onboarding
Disallow: /sign-in
`;

const EVERYWHERE_ELSE = `User-agent: *
Disallow: /
`;

// A route, not robots.ts: that is generated at build time, when the Worker has no PUBLIC_BASE_URL, and this differs per environment.
export async function GET(): Promise<Response> {
  const body = readConfig().baseUrl === 'https://xbul.io' ? PRODUCTION : EVERYWHERE_ELSE;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
