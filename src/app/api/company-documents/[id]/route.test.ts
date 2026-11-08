import { beforeEach, expect, it, vi } from 'vitest';
import { addCompanyDocument, createCompany, createSupplierRepositories } from '@/modules/supplier';
import { createTestDb } from '@/shared/db/testing';
import { GET } from './route';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `viewer` is who getViewer resolves to; null is a visitor who is not signed in.
const session = vi.hoisted(() => ({ viewer: null as { userId: string; isAdmin: boolean } | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({ getViewer: async () => session.viewer }));

const PDF = new TextEncoder().encode('%PDF-1.7 hello');

beforeEach(() => {
  session.viewer = null;
});

async function setup() {
  const db = await createTestDb();
  const { companies, documents } = createSupplierRepositories(db);
  const stored = new Map<string, Uint8Array>();
  const evidenceStore = { put: async (k: string, b: Uint8Array) => void stored.set(k, b), get: async (k: string) => stored.get(k) ?? null, delete: async (k: string) => void stored.delete(k) };
  container.current = { companies, documents, evidenceStore };
  await companies.save(createCompany({ name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'owner', contact: { email: 'sales@x.test' }, kind: 'fabric_mill' }));
  const doc = await addCompanyDocument({ companies, documents, store: evidenceStore }, { userId: 'owner', kind: 'tax_certificate', fileName: 'tax.pdf', bytes: PDF });
  return doc.id;
}

const get = (id: string) => GET(new Request(`http://x.test/api/company-documents/${id}`), { params: Promise.resolve({ id }) } as Parameters<typeof GET>[1]);

it('sends the file to its owner and to an admin as a private download', async () => {
  const id = await setup();
  for (const viewer of [{ userId: 'owner', isAdmin: false }, { userId: 'admin', isAdmin: true }]) {
    session.viewer = viewer;
    const response = await get(id);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'content-type': 'application/pdf',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    });
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; /);
  }
});

it('answers everyone else with an empty 404, the same as for an id that does not exist', async () => {
  const id = await setup();
  for (const viewer of [null, { userId: 'stranger', isAdmin: false }]) {
    session.viewer = viewer;
    for (const target of [id, crypto.randomUUID(), 'not-a-uuid']) {
      const response = await get(target);
      expect([response.status, await response.text()], `${JSON.stringify(viewer)} ${target}`).toEqual([404, '']);
    }
  }
});
