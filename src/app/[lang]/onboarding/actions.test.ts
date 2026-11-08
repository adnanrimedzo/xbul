import { expect, it, vi } from 'vitest';
import { createSupplierRepositories } from '@/modules/supplier';
import { createTestDb } from '@/shared/db/testing';
import { completeOnboardingAction } from './actions';

const container = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/server/container', () => ({ getContainer: async () => container }));
vi.mock('@/server/viewer', () => ({ requireViewer: async () => ({ userId: 'u1', email: 'sales@yeni.test' }) }));

const fields = { companyName: 'Yeni Konfeksiyon', city: 'Istanbul', country: 'TR', contactEmail: 'sales@yeni.test', phone: '', website: '' };
const form = (extra: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...fields, ...extra })) data.set(name, value);
  return data;
};

it.each([
  ['no kind chosen', ''],
  ['an unknown kind', 'wizard'],
])('refuses %s, saves nothing and echoes what was typed', async (_name, kind) => {
  const db = await createTestDb();
  container.db = db;
  expect(await completeOnboardingAction(null, form(kind ? { kind } : {}))).toEqual({
    ok: false,
    error: 'Choose what your company makes.',
    values: { kind, ...fields },
  });
  expect(await createSupplierRepositories(db).companies.findByOwner('u1')).toBeNull();
});

it('registers the company as the kind chosen, then goes to its registration page', async () => {
  const db = await createTestDb();
  container.db = db;
  await expect(completeOnboardingAction(null, form({ kind: 'garment_maker' }))).rejects.toMatchObject({ digest: expect.stringContaining('/m/yeni-konfeksiyon/registration') });
  expect(await createSupplierRepositories(db).companies.findByOwner('u1')).toMatchObject({ slug: 'yeni-konfeksiyon', kind: 'garment_maker' });
});
