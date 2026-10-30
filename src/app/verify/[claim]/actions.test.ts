import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { addEvidence, createClaimRepository, createEvidenceRepository, MAX_EVIDENCE_BYTES } from '@/modules/claims';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { removeEvidenceAction, submitForReviewAction, uploadEvidenceAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `mill` is the company requireMill resolves to; `refuse` makes it throw, as it does when it redirects.
const viewer = vi.hoisted(() => ({ mill: '', refuse: null as Error | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireMill: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return { userId: 'user', company: { id: viewer.mill, slug: 'indigo-mill' } };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const GENERIC = 'Something went wrong. Please try again.';
const PDF = new TextEncoder().encode('%PDF-1.7 hello');

beforeEach(() => {
  viewer.mill = DEMO.companies.indigo;
  viewer.refuse = null;
});
afterEach(() => vi.restoreAllMocks());

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const claims = createClaimRepository(db);
  const evidence = createEvidenceRepository(db);
  const stored = new Map<string, Uint8Array>();
  const evidenceStore = { put: async (k: string, b: Uint8Array) => void stored.set(k, b), get: async (k: string) => stored.get(k) ?? null, delete: async (k: string) => void stored.delete(k) };
  container.current = { claims, evidence, evidenceStore };
  const claim = (await claims.findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))!;
  const deps = { claims, evidence, store: evidenceStore };
  return {
    claimId: claim.id,
    stored,
    files: async () => evidence.listByClaim(claim.id),
    review: async () => (await claims.findById(claim.id))!.reviewStatus,
    addFile: () => addEvidence(deps, { companyId: DEMO.companies.indigo, claimId: claim.id, fileName: 'invoice.pdf', bytes: PDF }),
  };
}

const formWith = (file: unknown) => {
  const form = new FormData();
  if (file !== undefined) form.set('file', file as Blob | string);
  return form;
};
const pdfFile = (name = 'invoice.pdf') => new File([PDF], name, { type: 'application/pdf' });

it('stores a document for the supplier’s own claim', async () => {
  const { claimId, files, stored } = await setup();
  expect(await uploadEvidenceAction(claimId, null, formWith(pdfFile()))).toEqual({ ok: true, data: undefined });
  const [file] = await files();
  expect(file).toMatchObject({ fileName: 'invoice.pdf', contentType: 'application/pdf', sizeBytes: PDF.length });
  expect(stored.get(file!.storageKey)).toEqual(PDF);
});

it('refuses a file that is not a PDF, JPG or PNG, whatever it is called', async () => {
  const { claimId, files } = await setup();
  const notAPdf = new File(['not a pdf'], 'notes.pdf', { type: 'application/pdf' });
  expect(await uploadEvidenceAction(claimId, null, formWith(notAPdf))).toEqual({ ok: false, error: 'Upload a PDF, JPG or PNG file.' });
  expect(await files()).toEqual([]);
});

it('refuses a request with no file in it', async () => {
  const { claimId, files } = await setup();
  for (const form of [formWith(undefined), formWith('invoice.pdf')]) {
    expect(await uploadEvidenceAction(claimId, null, form)).toEqual({ ok: false, error: 'Upload a PDF, JPG or PNG file.' });
  }
  expect(await files()).toEqual([]);
});

it('refuses a file over 10 MB without reading it', async () => {
  const { claimId, files } = await setup();
  const read = vi.spyOn(Blob.prototype, 'arrayBuffer');
  const big = new File([new Uint8Array(MAX_EVIDENCE_BYTES + 1)], 'big.pdf', { type: 'application/pdf' });
  expect(await uploadEvidenceAction(claimId, null, formWith(big))).toEqual({ ok: false, error: 'Each file can be up to 10 MB.' });
  expect(read).not.toHaveBeenCalled();
  expect(await files()).toEqual([]);
});

it('takes a file of exactly 10 MB', async () => {
  const { claimId, files } = await setup();
  const bytes = new Uint8Array(MAX_EVIDENCE_BYTES);
  bytes.set(PDF);
  expect(await uploadEvidenceAction(claimId, null, formWith(new File([bytes], 'scan.pdf')))).toEqual({ ok: true, data: undefined });
  expect((await files())[0]?.sizeBytes).toBe(MAX_EVIDENCE_BYTES);
});

it('removes one of its own documents, from the store as well', async () => {
  const { claimId, addFile, files, stored } = await setup();
  const file = await addFile();
  expect(await removeEvidenceAction(claimId, file.id)).toEqual({ ok: true, data: undefined });
  expect(await files()).toEqual([]);
  expect(stored.size).toBe(0);
});

it('submits a claim with a document for review, and then changes nothing more', async () => {
  const { claimId, addFile, review } = await setup();
  expect(await submitForReviewAction(claimId)).toEqual({ ok: false, error: 'Add at least one document first.' });
  await addFile();
  expect(await submitForReviewAction(claimId)).toEqual({ ok: true, data: undefined });
  expect(await review()).toBe('pending');
  expect(await uploadEvidenceAction(claimId, null, formWith(pdfFile('b.pdf')))).toEqual({ ok: false, error: 'This claim is already being reviewed.' });
});

it('gives another supplier’s claim and documents the permission copy, and changes nothing', async () => {
  const { claimId, addFile, files, review } = await setup();
  const file = await addFile();
  viewer.mill = DEMO.companies.denizli;
  expect(await uploadEvidenceAction(claimId, null, formWith(pdfFile('b.pdf')))).toEqual({ ok: false, error: "You don't have permission to do that." });
  expect(await submitForReviewAction(claimId)).toEqual({ ok: false, error: "You don't have permission to do that." });
  expect(await removeEvidenceAction(claimId, file.id)).toEqual({ ok: false, error: 'That file no longer exists.' }); // not confirmed to exist
  expect(await files()).toHaveLength(1);
  expect(await review()).toBe('none');
});

it('answers an id that is not a uuid with the generic error', async () => {
  const { claimId } = await setup();
  expect(await uploadEvidenceAction('not-a-uuid', null, formWith(pdfFile()))).toEqual({ ok: false, error: GENERIC });
  expect(await removeEvidenceAction('not-a-uuid', crypto.randomUUID())).toEqual({ ok: false, error: GENERIC });
  expect(await removeEvidenceAction(claimId, 'not-a-uuid')).toEqual({ ok: false, error: GENERIC });
  expect(await submitForReviewAction('not-a-uuid')).toEqual({ ok: false, error: GENERIC });
});

it('lets a refused viewer’s redirect propagate before reading anything', async () => {
  const { claimId, files } = await setup();
  viewer.refuse = new Error('NEXT_REDIRECT');
  container.current = null; // a guard that ran second would fail on this instead
  await expect(uploadEvidenceAction(claimId, null, formWith(pdfFile()))).rejects.toThrow('NEXT_REDIRECT');
  await expect(removeEvidenceAction(claimId, crypto.randomUUID())).rejects.toThrow('NEXT_REDIRECT');
  await expect(submitForReviewAction(claimId)).rejects.toThrow('NEXT_REDIRECT');
  expect(await files()).toEqual([]);
});
