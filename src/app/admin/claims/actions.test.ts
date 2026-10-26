import { beforeEach, expect, it, vi } from 'vitest';
import { createClaimRepository, declareClaim } from '@/modules/claims';
import { listDeclaredOriginals } from '@/modules/discovery';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { verifyClaimAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `refuse` makes requireAdmin throw, as it does when it redirects a visitor who is not an admin.
const viewer = vi.hoisted(() => ({ refuse: null as Error | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireAdmin: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return {};
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const GENERIC = 'Something went wrong. Please try again.';

beforeEach(() => {
  viewer.refuse = null;
});

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const claims = createClaimRepository(db);
  container.current = { claims };
  const [declared] = await listDeclaredOriginals(db);
  return { db, claims, claimId: declared!.claimId, declaredCount: async () => (await listDeclaredOriginals(db)).length };
}

it('verifies a declared original', async () => {
  const { claimId, declaredCount } = await setup();
  expect(await verifyClaimAction(claimId)).toEqual({ ok: true, data: undefined });
  expect(await declaredCount()).toBe(0);
});

it('rejects a non-admin before reading anything, and verifies nothing', async () => {
  const { claimId, declaredCount } = await setup();
  viewer.refuse = new Error('NEXT_REDIRECT');
  container.current = null; // a guard that ran second would fail on this instead
  await expect(verifyClaimAction(claimId)).rejects.toThrow('NEXT_REDIRECT');
  expect(await declaredCount()).toBe(1);
});

it('answers an id that is not a uuid with the generic error', async () => {
  await setup();
  expect(await verifyClaimAction('not-a-uuid')).toEqual({ ok: false, error: GENERIC });
});

it('says a claim that no longer exists is gone', async () => {
  await setup();
  expect(await verifyClaimAction(crypto.randomUUID())).toEqual({ ok: false, error: 'That claim no longer exists.' });
});

it('explains that another mill is already verified as the original', async () => {
  const { claims, claimId } = await setup();
  expect(await verifyClaimAction(claimId)).toEqual({ ok: true, data: undefined }); // Indigo is now the verified original of Liu-Jo
  const rival = declareClaim({ productId: DEMO.products.liujo, companyId: DEMO.companies.denizli, articleId: null, kind: 'original' });
  await claims.save(rival);
  expect(await verifyClaimAction(rival.id)).toEqual({ ok: false, error: 'Another mill is already verified as the original for this garment.' });
});
