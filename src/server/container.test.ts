import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getContainer } from './container';

// A Workers request: getCloudflareContext returns its env and ctx, and after() queues work for after the response.
const workers = vi.hoisted(() => ({
  env: {} as { HYPERDRIVE?: { connectionString: string } },
  waitUntil: [] as Promise<unknown>[],
  after: [] as (() => unknown)[],
}));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: workers.env, ctx: { waitUntil: (p: Promise<unknown>) => workers.waitUntil.push(p) } }),
}));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => workers.after.push(fn) }));

// pg.Pool is lazy, so port 1 is never dialled.
const hyperdrive = 'postgres://u:p@127.0.0.1:1/hd';

beforeEach(() => {
  vi.stubEnv('BETTER_AUTH_SECRET', 's'.repeat(32));
  vi.stubEnv('PUBLIC_BASE_URL', 'https://xmanufacture.com');
  vi.stubEnv('DATABASE_URL', '');
  workers.env = { HYPERDRIVE: { connectionString: hyperdrive } };
  workers.waitUntil = [];
  workers.after = [];
});
afterEach(() => vi.unstubAllEnvs());

it('builds a fresh Hyperdrive pool per request and ends it after the response', async () => {
  const first = await getContainer();
  const second = await getContainer();
  expect(first.db).not.toBe(second.db);
  expect(workers.waitUntil).toHaveLength(0);
  workers.after.forEach((fn) => fn());
  expect(workers.waitUntil).toHaveLength(2);
  await Promise.all(workers.waitUntil);
});

it('refuses to run on Workers without the HYPERDRIVE binding', async () => {
  workers.env = {};
  await expect(getContainer()).rejects.toThrow(/HYPERDRIVE/);
});

it('refuses a DATABASE_URL on Workers instead of sharing a pool or opening PGlite', async () => {
  for (const url of [hyperdrive, './.data/dev']) {
    vi.stubEnv('DATABASE_URL', url);
    await expect(getContainer(), url).rejects.toThrow(/DATABASE_URL/);
  }
});
