import { beforeEach, expect, it, vi } from 'vitest';
import { createClaimRepository } from '@/modules/claims';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { withdrawClaimAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `mill` is the company requireMill resolves to; `refuse` makes it throw, as it does when it redirects.
const viewer = vi.hoisted(() => ({ mill: '', refuse: null as Error | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireMill: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return { company: { id: viewer.mill } };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  viewer.mill = DEMO.companies.indigo;
  viewer.refuse = null;
});

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const claims = createClaimRepository(db);
  container.current = { claims };
  const claim = (await claims.findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))!;
  return { claimId: claim.id, exists: async () => (await claims.findById(claim.id)) !== null };
}

it('removes the mill’s own claim', async () => {
  const { claimId, exists } = await setup();
  expect(await withdrawClaimAction(claimId)).toEqual({ ok: true, data: undefined });
  expect(await exists()).toBe(false);
});

it('refuses another mill’s claim and keeps it', async () => {
  const { claimId, exists } = await setup();
  viewer.mill = DEMO.companies.denizli;
  expect(await withdrawClaimAction(claimId)).toEqual({ ok: false, error: "You don't have permission to do that." });
  expect(await exists()).toBe(true);
});

it('answers an id that is not a uuid with the generic error', async () => {
  await setup();
  expect(await withdrawClaimAction('not-a-uuid')).toEqual({ ok: false, error: 'Something went wrong. Please try again.' });
});

it('lets a refused viewer’s redirect propagate before reading anything', async () => {
  const { claimId, exists } = await setup();
  viewer.refuse = new Error('NEXT_REDIRECT');
  container.current = null; // a guard that ran second would fail on this instead
  await expect(withdrawClaimAction(claimId)).rejects.toThrow('NEXT_REDIRECT');
  expect(await exists()).toBe(true);
});
