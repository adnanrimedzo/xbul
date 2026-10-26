import { beforeEach, expect, it, vi } from 'vitest';
import { createInquiryRepository } from '@/modules/inquiry';
import { listCompanyInquiries } from '@/modules/discovery';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { markAnsweredAction } from './actions';

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

const GENERIC = 'Something went wrong. Please try again.';

beforeEach(() => {
  viewer.mill = DEMO.companies.indigo;
  viewer.refuse = null;
});

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  container.current = { inquiries: createInquiryRepository(db) };
  const [seeded] = await listCompanyInquiries(db, DEMO.companies.indigo);
  const statusOf = async () => (await listCompanyInquiries(db, DEMO.companies.indigo))[0]!.status;
  return { inquiryId: seeded!.id, statusOf };
}

it('marks the mill’s own request answered', async () => {
  const { inquiryId, statusOf } = await setup();
  expect(await markAnsweredAction(inquiryId)).toEqual({ ok: true, data: undefined });
  expect(await statusOf()).toBe('answered');
});

it('refuses a request that belongs to another mill, and leaves it new', async () => {
  const { inquiryId, statusOf } = await setup();
  viewer.mill = DEMO.companies.denizli;
  expect(await markAnsweredAction(inquiryId)).toEqual({ ok: false, error: "You don't have permission to do that." });
  expect(await statusOf()).toBe('new');
});

it('says a request that no longer exists is gone', async () => {
  await setup();
  expect(await markAnsweredAction(crypto.randomUUID())).toEqual({ ok: false, error: 'That request no longer exists.' });
});

it('answers an id that is not a uuid with the generic error, before touching the repository', async () => {
  await setup();
  container.current = { inquiries: { findById: vi.fn(), save: vi.fn() } };
  expect(await markAnsweredAction('not-a-uuid')).toEqual({ ok: false, error: GENERIC });
  const { inquiries } = container.current as { inquiries: { findById: ReturnType<typeof vi.fn> } };
  expect(inquiries.findById).not.toHaveBeenCalled();
});

it('lets a refused viewer’s redirect propagate and answers nothing', async () => {
  const { inquiryId, statusOf } = await setup();
  viewer.refuse = new Error('NEXT_REDIRECT');
  await expect(markAnsweredAction(inquiryId)).rejects.toThrow('NEXT_REDIRECT');
  expect(await statusOf()).toBe('new');
});
