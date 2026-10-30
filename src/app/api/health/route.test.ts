import { expect, it, vi } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { GET } from './route';

const container = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));

it('answers ok when the database answers', async () => {
  container.current = { db: await createTestDb() };
  const res = await GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
  expect(res.headers.get('cache-control')).toBe('no-store');
});

it('answers 503 with no details when the database fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  container.current = { db: { execute: () => Promise.reject(new Error('secret-host:5432 refused')) } };
  const res = await GET();
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain('secret-host');
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
