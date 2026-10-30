import { afterEach, expect, it, vi } from 'vitest';
import { createProduct, createProductRepository } from '@/modules/catalog';
import { createCompany, createSupplierRepositories } from '@/modules/supplier';
import { createTestDb } from '@/shared/db/testing';
import { declareClaim, verifyClaim } from '../domain/claim';
import { createClaimRepository } from '../infrastructure/drizzle-claim-repository';
import { createEvidenceRepository } from '../infrastructure/drizzle-evidence-repository';
import { addEvidence, approveClaimReview, readEvidence, rejectClaimReview, removeEvidence, submitClaimForReview } from './evidence';
import type { EvidenceDeps, EvidenceStore } from './ports';
import { withdrawClaim } from './withdraw-claim';

const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const db = await createTestDb();
  const { companies } = createSupplierRepositories(db);
  const products = createProductRepository(db);
  const company = async (name: string, owner: string) => {
    const c = createCompany({ name, city: 'Istanbul', country: 'TR', ownerUserId: owner, contact: { email: 'sales@x.test' }, kind: 'fabric_mill' });
    await companies.save(c);
    return c.id;
  };
  const indigo = await company('Indigo Mill', 'u1');
  const denizli = await company('Denizli Indigo', 'u2');
  const product = createProduct({ canonicalUrl: 'https://example.com/guess', sourceUrl: 'https://example.com/guess', brand: 'GUESS', name: 'Cropped Denim Blazer', imageUrl: null, composition: null });
  await products.save(product);

  const claims = createClaimRepository(db);
  const claim = declareClaim({ productId: product.id, companyId: indigo, articleId: null, kind: 'original', scope: 'fabric' });
  const rivalClaim = declareClaim({ productId: product.id, companyId: denizli, articleId: null, kind: 'original', scope: 'fabric' });
  await claims.save(claim);
  await claims.save(rivalClaim);

  const stored = new Map<string, Uint8Array>();
  const store: EvidenceStore = {
    put: async (key, bytes) => void stored.set(key, bytes),
    get: async (key) => stored.get(key) ?? null,
    delete: async (key) => void stored.delete(key),
  };
  const deps: EvidenceDeps = { claims, evidence: createEvidenceRepository(db), store };
  return { deps, stored, ids: { indigo, denizli, claim: claim.id, rivalClaim, product: product.id } };
}

it('takes a supplier’s evidence through review and deletes the files once approved', async () => {
  const { deps, ids, stored } = await setup();
  await expect(submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim })).rejects.toMatchObject({ code: 'evidence.required' });
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'invoice.pdf', bytes: PDF });
  expect(stored.has(e.storageKey)).toBe(true);
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'b.pdf', bytes: PDF })).rejects.toMatchObject({ code: 'claim.already_in_review' });
  await expect(removeEvidence(deps, { companyId: ids.indigo, evidenceId: e.id })).rejects.toMatchObject({ code: 'claim.already_in_review' });
  const approved = await approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' });
  expect(approved).toMatchObject({ status: 'verified', reviewedBy: 'admin1' });
  expect(await deps.claims.findById(ids.claim)).toEqual(approved);
  expect(stored.size).toBe(0);
  expect(await deps.evidence.listByClaim(ids.claim)).toEqual([]);
});

it('a rejection deletes the files, keeps the note, and lets the supplier try again', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  expect(await rejectClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1', note: 'Unreadable' })).toMatchObject({ reviewStatus: 'rejected', reviewNote: 'Unreadable' });
  expect(await deps.claims.findById(ids.claim)).toMatchObject({ status: 'declared', reviewStatus: 'rejected', reviewNote: 'Unreadable', reviewedBy: 'admin1' });
  expect(stored.size).toBe(0);
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'b.pdf', bytes: PDF })).resolves.toBeTruthy();
});

it('only the owning supplier and admins can read a file; everyone else sees nothing', async () => {
  const { deps, ids } = await setup();
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  expect((await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: false, companyId: ids.indigo } }))?.bytes).toEqual(PDF);
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: true, companyId: null } })).not.toBeNull();
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: false, companyId: ids.denizli } })).toBeNull();
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: false, companyId: null } })).toBeNull();
});

it('answers an unknown id and a file whose bytes are gone with nothing, the same as a stranger gets', async () => {
  const { deps, ids, stored } = await setup();
  const owner = { isAdmin: false, companyId: ids.indigo };
  expect(await readEvidence(deps, { evidenceId: crypto.randomUUID(), viewer: { isAdmin: true, companyId: null } })).toBeNull();
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: JPG });
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: owner })).toMatchObject({ evidence: { id: e.id, contentType: 'image/jpeg', fileName: 'a.pdf.jpg' } }); // a name never keeps an extension the bytes don't have
  stored.clear();
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: owner })).toBeNull();
});

it('refuses another supplier’s claim, a sixth file, and a second verified original', async () => {
  const { deps, ids } = await setup();
  await expect(addEvidence(deps, { companyId: ids.denizli, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF })).rejects.toMatchObject({ code: 'auth.forbidden' });
  for (let i = 0; i < 5; i++) await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: `${i}.pdf`, bytes: PDF });
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: '6.pdf', bytes: PDF })).rejects.toMatchObject({ code: 'evidence.too_many' });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await deps.claims.save(verifyClaim(ids.rivalClaim));
  await expect(approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' })).rejects.toMatchObject({ code: 'claim.already_verified_original' });
});

it('keeps the files and the review when an approval is refused', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await deps.claims.save(verifyClaim(ids.rivalClaim));
  await expect(approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' })).rejects.toMatchObject({ code: 'claim.already_verified_original' });
  expect(stored.size).toBe(1);
  expect(await deps.evidence.listByClaim(ids.claim)).toHaveLength(1);
  expect(await deps.claims.findById(ids.claim)).toMatchObject({ status: 'declared', reviewStatus: 'pending' });
});

it('refuses a file by its bytes, not its name, and stores nothing', async () => {
  const { deps, ids, stored } = await setup();
  const html = new TextEncoder().encode('<html><script>alert(1)</script>');
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'invoice.pdf', bytes: html })).rejects.toMatchObject({ code: 'evidence.type_invalid' });
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'invoice.pdf', bytes: new Uint8Array(0) })).rejects.toMatchObject({ code: 'evidence.type_invalid' });
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'invoice.png', bytes: PNG })).resolves.toMatchObject({ contentType: 'image/png' });
  expect(stored.size).toBe(1);
});

it('takes files only for a declared original, and says which rule applies', async () => {
  const { deps, ids } = await setup();
  const add = (claimId: string, companyId: string) => addEvidence(deps, { companyId, claimId, fileName: 'a.pdf', bytes: PDF });
  await expect(add(crypto.randomUUID(), ids.indigo)).rejects.toMatchObject({ code: 'claim.not_found' });
  await deps.claims.save({ ...ids.rivalClaim, kind: 'equivalent' });
  await expect(add(ids.rivalClaim.id, ids.denizli)).rejects.toMatchObject({ code: 'claim.only_original_verifiable' });
  await deps.claims.save(verifyClaim({ ...ids.rivalClaim, kind: 'original' }));
  await expect(add(ids.rivalClaim.id, ids.denizli)).rejects.toMatchObject({ code: 'claim.already_verified_original' });
});

it('lets a supplier remove its own file but nobody else’s, and a stranger learns nothing', async () => {
  const { deps, ids, stored } = await setup();
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await expect(removeEvidence(deps, { companyId: ids.denizli, evidenceId: e.id })).rejects.toMatchObject({ code: 'evidence.not_found' });
  await expect(removeEvidence(deps, { companyId: ids.indigo, evidenceId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'evidence.not_found' });
  expect(stored.size).toBe(1);
  await removeEvidence(deps, { companyId: ids.indigo, evidenceId: e.id });
  expect(stored.size).toBe(0);
  expect(await deps.evidence.findById(e.id)).toBeNull();
});

it('only the owner can send a claim in', async () => {
  const { deps, ids } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await expect(submitClaimForReview(deps, { companyId: ids.denizli, claimId: ids.claim })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect(await deps.claims.findById(ids.claim)).toMatchObject({ reviewStatus: 'none' });
});

it('decides only a claim that is waiting for review, and a rejection needs a note', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await expect(approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' })).rejects.toMatchObject({ code: 'claim.not_in_review' });
  await expect(rejectClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1', note: 'No' })).rejects.toMatchObject({ code: 'claim.not_in_review' });
  await expect(approveClaimReview(deps, { claimId: crypto.randomUUID(), adminUserId: 'admin1' })).rejects.toMatchObject({ code: 'claim.not_found' });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await expect(rejectClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1', note: '  ' })).rejects.toMatchObject({ code: 'claim.review_note_invalid' });
  expect(stored.size).toBe(1);
  expect(await deps.claims.findById(ids.claim)).toMatchObject({ reviewStatus: 'pending' });
});

it('a decision deletes only that claim’s files', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  const other = await addEvidence(deps, { companyId: ids.denizli, claimId: ids.rivalClaim.id, fileName: 'b.pdf', bytes: PDF });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' });
  expect([...stored.keys()]).toEqual([other.storageKey]);
});

it('a file that can’t be deleted is logged and does not undo the decision', async () => {
  const { deps, ids } = await setup();
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'b.pdf', bytes: PDF });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  const failing = { ...deps, store: { ...deps.store, delete: vi.fn().mockRejectedValue(new Error('r2 down')) } };
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(await approveClaimReview(failing, { claimId: ids.claim, adminUserId: 'admin1' })).toMatchObject({ status: 'verified' });
  expect(failing.store.delete).toHaveBeenCalledTimes(2); // the second file is still tried
  expect(log).toHaveBeenCalledTimes(2);
  expect(log.mock.calls.some(([message]) => String(message).includes(e.storageKey))).toBe(true);
  expect(await deps.evidence.listByClaim(ids.claim)).toEqual([]);
});

it('still deletes the files when the rows can’t be deleted, and the decision stands', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  const failing = { ...deps, evidence: { ...deps.evidence, deleteByClaim: vi.fn().mockRejectedValue(new Error('db down')) } };
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(approveClaimReview(failing, { claimId: ids.claim, adminUserId: 'admin1' })).resolves.toMatchObject({ status: 'verified' });
  expect(await deps.claims.findById(ids.claim)).toMatchObject({ status: 'verified', reviewedBy: 'admin1' });
  expect(stored.size).toBe(0);
  expect(log).toHaveBeenCalledWith(expect.stringContaining(ids.claim), expect.any(Error));
});

it('keeps the row when its file can’t be deleted, so removing it can be retried', async () => {
  const { deps, ids, stored } = await setup();
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  const failing = { ...deps, store: { ...deps.store, delete: vi.fn().mockRejectedValue(new Error('r2 down')) } };
  await expect(removeEvidence(failing, { companyId: ids.indigo, evidenceId: e.id })).rejects.toThrow('r2 down');
  expect(await deps.evidence.listByClaim(ids.claim)).toEqual([e]);
  expect(stored.size).toBe(1);
  await removeEvidence(deps, { companyId: ids.indigo, evidenceId: e.id }); // the retry
  expect(await deps.evidence.listByClaim(ids.claim)).toEqual([]);
  expect(stored.size).toBe(0);
});

it('stores nothing behind a row that failed to save', async () => {
  const { deps, ids, stored } = await setup();
  const broken = { ...deps, evidence: { ...deps.evidence, save: vi.fn().mockRejectedValue(new Error('db down')) } };
  await expect(addEvidence(broken, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF })).rejects.toThrow('db down');
  expect(stored.size).toBe(0);
});

it('withdrawing a claim deletes its files', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await withdrawClaim(deps, { companyId: ids.indigo, claimId: ids.claim });
  expect(stored.size).toBe(0);
  expect(await deps.claims.findById(ids.claim)).toBeNull();
});

it('withdrawing another supplier’s claim deletes nothing', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await expect(withdrawClaim(deps, { companyId: ids.denizli, claimId: ids.claim })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect(stored.size).toBe(1);
  expect(await deps.claims.findById(ids.claim)).not.toBeNull();
});
