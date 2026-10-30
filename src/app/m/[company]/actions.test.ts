import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { addEvidence, createClaimRepository, createEvidenceRepository, createLocalEvidenceStore } from '@/modules/claims';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { updateContactAction, withdrawClaimAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `mill` and `user` are the company and owner requireMill resolves to; `refuse` makes it throw, as it does when it redirects.
const viewer = vi.hoisted(() => ({ mill: '', user: '', refuse: null as Error | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireMill: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return { userId: viewer.user, company: { id: viewer.mill } };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The action stores evidence under EVIDENCE_DIR; each test gets a folder of its own, removed afterwards.
let evidenceDir: string;
beforeEach(() => {
  viewer.mill = DEMO.companies.indigo;
  viewer.user = DEMO.users.mill;
  viewer.refuse = null;
  evidenceDir = mkdtempSync(join(tmpdir(), 'xm-actions-evidence-'));
  vi.stubEnv('EVIDENCE_DIR', evidenceDir);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(evidenceDir, { recursive: true, force: true });
});

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const claims = createClaimRepository(db);
  container.current = { claims, db };
  const claim = (await claims.findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))!;
  return { db, claims, claimId: claim.id, exists: async () => (await claims.findById(claim.id)) !== null };
}

it('removes the mill’s own claim', async () => {
  const { claimId, exists } = await setup();
  expect(await withdrawClaimAction(claimId)).toEqual({ ok: true, data: undefined });
  expect(await exists()).toBe(false);
});

it('deletes the claim’s files with it', async () => {
  const { db, claims, claimId } = await setup();
  const store = createLocalEvidenceStore(evidenceDir);
  const file = await addEvidence({ claims, evidence: createEvidenceRepository(db), store }, { companyId: DEMO.companies.indigo, claimId, fileName: 'invoice.pdf', bytes: new TextEncoder().encode('%PDF-1.7 hello') });
  expect(await store.get(file.storageKey)).not.toBeNull();
  expect(await withdrawClaimAction(claimId)).toEqual({ ok: true, data: undefined });
  expect(await store.get(file.storageKey)).toBeNull();
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

async function setupContact() {
  const db = await createTestDb();
  await seedDemo(db);
  const { companies } = createSupplierRepositories(db);
  container.current = { companies };
  return { contactOf: async (id: string) => (await companies.findById(id))!.contact };
}
const contactForm = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
};

it('saves the viewer’s own contact details', async () => {
  const { contactOf } = await setupContact();
  expect(await updateContactAction(null, contactForm({ email: 'Hello@Indigo-Mill.example', phone: '+90 212 555 0100', website: 'indigo-mill.example/about' })))
    .toEqual({ ok: true, data: undefined });
  expect(await contactOf(DEMO.companies.indigo)).toEqual({ email: 'hello@indigo-mill.example', phone: '+90 212 555 0100', website: 'https://indigo-mill.example/about' });
});

it('answers a bad website with the copy and keeps what was saved', async () => {
  const { contactOf } = await setupContact();
  const before = await contactOf(DEMO.companies.indigo);
  expect(await updateContactAction(null, contactForm({ email: 'hello@indigo-mill.example', website: 'javascript:alert(1)' })))
    .toEqual({ ok: false, error: 'Enter a valid website address.' });
  expect(await updateContactAction(null, contactForm({ email: '', phone: '', website: '' })))
    .toEqual({ ok: false, error: 'Add an email, phone or website so buyers can reach you.' });
  expect(await contactOf(DEMO.companies.indigo)).toEqual(before);
});

it('takes the company from the viewer, never from the form', async () => {
  const { contactOf } = await setupContact();
  const other = await contactOf(DEMO.companies.denizli);
  // A forged id in the form changes nothing: the action reads only email, phone and website.
  await updateContactAction(null, contactForm({ email: 'hello@indigo-mill.example', companyId: DEMO.companies.denizli, ownerUserId: DEMO.users.denizli }));
  expect(await contactOf(DEMO.companies.denizli)).toEqual(other);
  expect((await contactOf(DEMO.companies.indigo)).email).toBe('hello@indigo-mill.example');
});

it('lets a refused viewer’s redirect propagate before touching contact details', async () => {
  const { contactOf } = await setupContact();
  const before = await contactOf(DEMO.companies.indigo);
  viewer.refuse = new Error('NEXT_REDIRECT');
  await expect(updateContactAction(null, contactForm({ email: 'x@y.test' }))).rejects.toThrow('NEXT_REDIRECT');
  expect(await contactOf(DEMO.companies.indigo)).toEqual(before);
});
