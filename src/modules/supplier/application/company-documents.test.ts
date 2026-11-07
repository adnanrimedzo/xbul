import { afterEach, expect, it, vi } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createCompany } from '../domain/company';
import { createSupplierRepositories } from '../infrastructure/drizzle-repositories';
import { addCompanyDocument, purgeCompanyDocuments, readCompanyDocument, removeCompanyDocument } from './company-documents';
import type { DocumentDeps, DocumentStore } from './ports';

const PDF = new TextEncoder().encode('%PDF-1.7 hello');

afterEach(() => vi.restoreAllMocks());

async function setup() {
  const db = await createTestDb();
  const repos = createSupplierRepositories(db);
  const owner = createCompany({ name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'sales@x.test' }, kind: 'fabric_mill' });
  await repos.companies.save(owner);
  const other = createCompany({ name: 'Denizli Indigo', city: 'Denizli', country: 'TR', ownerUserId: 'u2', contact: { email: 'sales@y.test' }, kind: 'fabric_mill' });
  await repos.companies.save(other);
  const stored = new Map<string, Uint8Array>();
  const store: DocumentStore = {
    put: async (key, bytes) => void stored.set(key, bytes),
    get: async (key) => stored.get(key) ?? null,
    delete: async (key) => void stored.delete(key),
  };
  const deps: DocumentDeps = { companies: repos.companies, documents: repos.documents, store };
  const add = (kind = 'tax_certificate', bytes = PDF) => addCompanyDocument(deps, { userId: 'u1', kind, fileName: 'tax.pdf', bytes });
  return { deps, stored, repos, owner, other, add };
}

it('stores the owner’s document privately under the company', async () => {
  const { deps, stored, owner, add } = await setup();
  const doc = await add();
  expect(await deps.documents.listByCompany(owner.id)).toEqual([doc]);
  expect(doc.storageKey).toBe(`company-docs/${owner.id}/${doc.id}`);
  expect(stored.get(doc.storageKey)).toEqual(PDF);
});

it('refuses an unknown kind, a file that is not a PDF or image, and an 11th document', async () => {
  const { add } = await setup();
  await expect(add('passport')).rejects.toMatchObject({ code: 'document.kind_invalid' });
  await expect(add('other', new TextEncoder().encode('hello'))).rejects.toMatchObject({ code: 'evidence.type_invalid' });
  for (let i = 0; i < 10; i++) await add('other');
  await expect(add('other')).rejects.toMatchObject({ code: 'document.too_many' });
});

it('locks adding and removing once the company is submitted', async () => {
  const { deps, repos, owner, add } = await setup();
  const doc = await add();
  await repos.companies.save({ ...owner, status: 'submitted' });
  await expect(add()).rejects.toMatchObject({ code: 'registration.locked' });
  await expect(removeCompanyDocument(deps, { userId: 'u1', documentId: doc.id })).rejects.toMatchObject({ code: 'registration.locked' });
});

it('lets the owner remove a document and hides it from other users', async () => {
  const { deps, stored, owner, add } = await setup();
  const doc = await add();
  await expect(removeCompanyDocument(deps, { userId: 'u2', documentId: doc.id })).rejects.toMatchObject({ code: 'document.not_found' });
  await removeCompanyDocument(deps, { userId: 'u1', documentId: doc.id });
  expect(await deps.documents.listByCompany(owner.id)).toEqual([]);
  expect(stored.size).toBe(0);
});

it('gives the bytes to the owner and admins only', async () => {
  const { deps, add } = await setup();
  const doc = await add();
  expect((await readCompanyDocument(deps, { documentId: doc.id, viewer: { userId: 'u1', isAdmin: false } }))?.bytes).toEqual(PDF);
  expect((await readCompanyDocument(deps, { documentId: doc.id, viewer: { userId: 'a1', isAdmin: true } }))?.bytes).toEqual(PDF);
  expect(await readCompanyDocument(deps, { documentId: doc.id, viewer: { userId: 'u2', isAdmin: false } })).toBeNull();
  expect(await readCompanyDocument(deps, { documentId: crypto.randomUUID(), viewer: { userId: 'a1', isAdmin: true } })).toBeNull();
});

it('deletes the stored bytes when the row cannot be saved', async () => {
  const { deps, stored, add } = await setup();
  vi.spyOn(deps.documents, 'save').mockRejectedValueOnce(new Error('db down'));
  await expect(add()).rejects.toThrow('db down');
  expect(stored.size).toBe(0);
});

it('purges rows and files, and still removes the rows when a file cannot be deleted', async () => {
  const { deps, stored, owner, add } = await setup();
  await add();
  await add('other');
  expect(await purgeCompanyDocuments(deps, owner.id)).toHaveLength(2);
  expect(stored.size).toBe(0);
  expect(await deps.documents.listByCompany(owner.id)).toEqual([]);

  await add();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(deps.store, 'delete').mockRejectedValue(new Error('r2 down'));
  await expect(purgeCompanyDocuments(deps, owner.id)).resolves.toHaveLength(1);
  expect(await deps.documents.listByCompany(owner.id)).toEqual([]);
});
