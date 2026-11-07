import { beforeEach, expect, it, vi } from 'vitest';
import { addEvidence, createClaimRepository, createEvidenceRepository, declareClaim, submitClaimForReview } from '@/modules/claims';
import { listPendingReviews } from '@/modules/discovery';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { approveReviewAction, rejectReviewAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `refuse` makes requireAdmin throw, as it does when it redirects a visitor who is not an admin.
const viewer = vi.hoisted(() => ({ refuse: null as Error | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireAdmin: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return { userId: 'admin-1' };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const GENERIC = 'Something went wrong. Please try again.';
const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const noteForm = (note: string) => {
  const form = new FormData();
  form.set('note', note);
  return form;
};

beforeEach(() => {
  viewer.refuse = null;
});

// Indigo Mill has sent in its documents for LIU-JO; the queue holds that one claim.
async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const claims = createClaimRepository(db);
  const evidence = createEvidenceRepository(db);
  const stored = new Map<string, Uint8Array>();
  const evidenceStore = { put: async (k: string, b: Uint8Array) => void stored.set(k, b), get: async (k: string) => stored.get(k) ?? null, delete: async (k: string) => void stored.delete(k) };
  container.current = { claims, evidence, evidenceStore };
  const deps = { claims, evidence, store: evidenceStore };
  const sendIn = async (claimId: string, companyId: string) => {
    await addEvidence(deps, { companyId, claimId, fileName: 'invoice.pdf', bytes: PDF });
    await submitClaimForReview(deps, { companyId, claimId });
  };
  const claim = (await claims.findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))!;
  await sendIn(claim.id, DEMO.companies.indigo);
  return { claims, stored, sendIn, claimId: claim.id, pendingCount: async () => (await listPendingReviews(db)).length };
}

it('approves a review, verifying the claim for the admin who decided and deleting the documents', async () => {
  const { claims, claimId, pendingCount, stored } = await setup();
  expect(await approveReviewAction(claimId)).toEqual({ ok: true, data: undefined });
  expect(await claims.findById(claimId)).toMatchObject({ status: 'verified', reviewedBy: 'admin-1' });
  expect(await pendingCount()).toBe(0);
  expect(stored.size).toBe(0);
});

it('rejects a review with the admin’s reason, keeping it for the supplier, and deletes the documents', async () => {
  const { claims, claimId, pendingCount, stored } = await setup();
  expect(await rejectReviewAction(claimId, null, noteForm('  The invoice is unreadable '))).toEqual({ ok: true, data: undefined });
  expect(await claims.findById(claimId)).toMatchObject({ status: 'declared', reviewStatus: 'rejected', reviewNote: 'The invoice is unreadable', reviewedBy: 'admin-1' });
  expect(await pendingCount()).toBe(0);
  expect(stored.size).toBe(0);
});

it('asks for a reason, and keeps the review waiting without one', async () => {
  const { claimId, pendingCount } = await setup();
  const missing = new FormData();
  for (const form of [noteForm('   '), noteForm('x'.repeat(501)), missing]) {
    expect(await rejectReviewAction(claimId, null, form)).toEqual({ ok: false, error: 'Add a note of up to 500 characters.' });
  }
  expect(await pendingCount()).toBe(1);
});

it('rejects a non-admin before reading anything, and decides nothing', async () => {
  const { claimId, pendingCount } = await setup();
  viewer.refuse = new Error('NEXT_REDIRECT');
  container.current = null; // a guard that ran second would fail on this instead
  await expect(approveReviewAction(claimId)).rejects.toThrow('NEXT_REDIRECT');
  await expect(rejectReviewAction(claimId, null, noteForm('no'))).rejects.toThrow('NEXT_REDIRECT');
  expect(await pendingCount()).toBe(1);
});

it('answers an id that is not a uuid with the generic error', async () => {
  await setup();
  expect(await approveReviewAction('not-a-uuid')).toEqual({ ok: false, error: GENERIC });
  expect(await rejectReviewAction('not-a-uuid', null, noteForm('no'))).toEqual({ ok: false, error: GENERIC });
});

it('says a claim that no longer exists is gone, and one that is not in review is not waiting', async () => {
  const { claims } = await setup();
  expect(await approveReviewAction(crypto.randomUUID())).toEqual({ ok: false, error: 'That claim no longer exists.' });
  const decided = (await claims.findByProductAndCompany(DEMO.products.guess, DEMO.companies.indigo))!; // verified in the seed
  expect(await approveReviewAction(decided.id)).toEqual({ ok: false, error: "This claim isn't waiting for review." });
  expect(await rejectReviewAction(decided.id, null, noteForm('no'))).toEqual({ ok: false, error: "This claim isn't waiting for review." });
});

it('explains that another supplier is already verified as the original', async () => {
  const { claims, claimId, sendIn } = await setup();
  expect(await approveReviewAction(claimId)).toEqual({ ok: true, data: undefined }); // Indigo is now the verified original of LIU-JO
  const rival = declareClaim({ productId: DEMO.products.liujo, companyId: DEMO.companies.denizli, articleId: null, kind: 'original', scope: 'fabric' });
  await claims.save(rival);
  await sendIn(rival.id, DEMO.companies.denizli);
  expect(await approveReviewAction(rival.id)).toEqual({ ok: false, error: 'Another supplier is already verified as the original for this product.' });
});
