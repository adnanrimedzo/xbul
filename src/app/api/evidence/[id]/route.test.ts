import { beforeEach, expect, it, vi } from 'vitest';
import { addEvidence, createClaimRepository, createEvidenceRepository } from '@/modules/claims';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { GET } from './route';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `viewer` is who getViewer resolves to; null is a visitor who is not signed in.
const session = vi.hoisted(() => ({ viewer: null as { isAdmin: boolean; company: { id: string } | null } | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({ getViewer: async () => session.viewer }));

const PDF = new TextEncoder().encode('%PDF-1.7 hello');

beforeEach(() => {
  session.viewer = null;
});

async function setup(fileName = 'invoice.pdf') {
  const db = await createTestDb();
  await seedDemo(db);
  const claims = createClaimRepository(db);
  const evidence = createEvidenceRepository(db);
  const stored = new Map<string, Uint8Array>();
  const evidenceStore = { put: async (k: string, b: Uint8Array) => void stored.set(k, b), get: async (k: string) => stored.get(k) ?? null, delete: async (k: string) => void stored.delete(k) };
  container.current = { claims, evidence, evidenceStore };
  const claim = (await claims.findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))!;
  const file = await addEvidence({ claims, evidence, store: evidenceStore }, { companyId: DEMO.companies.indigo, claimId: claim.id, fileName, bytes: PDF });
  return file.id;
}

const get = (id: string) => GET(new Request(`http://x.test/api/evidence/${id}`), { params: Promise.resolve({ id }) } as Parameters<typeof GET>[1]);

it('sends the file to its supplier and to an admin as a private download', async () => {
  const id = await setup('фактура "1".pdf');
  for (const viewer of [{ isAdmin: false, company: { id: DEMO.companies.indigo } }, { isAdmin: true, company: null }]) {
    session.viewer = viewer;
    const response = await get(id);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'content-type': 'application/pdf',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    });
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="_{7} _1_\.pdf"; filename\*=UTF-8''%D1%84/);
  }
});

it('answers everyone else with an empty 404, the same as for an id that does not exist', async () => {
  const id = await setup();
  const strangers = [null, { isAdmin: false, company: null }, { isAdmin: false, company: { id: DEMO.companies.denizli } }];
  for (const viewer of strangers) {
    session.viewer = viewer;
    for (const target of [id, crypto.randomUUID(), 'not-a-uuid']) {
      const response = await get(target);
      expect([response.status, await response.text()], `${JSON.stringify(viewer)} ${target}`).toEqual([404, '']);
    }
  }
});
