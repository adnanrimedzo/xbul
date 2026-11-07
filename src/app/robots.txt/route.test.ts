import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GET } from './route';

beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', 's'.repeat(32)));
afterEach(() => vi.unstubAllEnvs());

test('production allows the public site and blocks private paths', async () => {
  vi.stubEnv('PUBLIC_BASE_URL', 'https://xbul.io');
  const text = await (await GET()).text();
  expect(text).toContain('Allow: /');
  for (const path of ['/admin/', '/add', '/api/', '/verify/', '/onboarding', '/sign-in']) {
    expect(text).toContain(`Disallow: ${path}`);
    expect(text).toContain(`Disallow: /tr${path}`);
  }
  expect(text).toContain('Sitemap: https://xbul.io/sitemap.xml');
});

test('anywhere else blocks everything', async () => {
  vi.stubEnv('PUBLIC_BASE_URL', 'https://staging.xbul.io');
  const text = await (await GET()).text();
  expect(text).toContain('Disallow: /');
  expect(text).not.toContain('Allow: /');
});
