import { DomainError } from '@/shared/domain/errors';
import type { Company } from '../domain/company';
import { createCompanyDocument, MAX_COMPANY_DOCUMENTS, type CompanyDocument } from '../domain/company-document';
import { assertOwnerCanEdit } from '../domain/registration';
import type { DocumentDeps, DocumentStore } from './ports';

async function ownCompany(deps: DocumentDeps, userId: string): Promise<Company> {
  const company = await deps.companies.findByOwner(userId);
  if (!company) throw new DomainError('auth.forbidden');
  return company;
}

// A file that can't be deleted is logged, with its key so it can be cleaned up by hand, and never fails the caller.
async function deleteStoredFiles(store: DocumentStore, files: readonly CompanyDocument[]): Promise<void> {
  for (const file of files) {
    try {
      await store.delete(file.storageKey);
    } catch (e) {
      console.error(`[company-documents] could not delete ${file.storageKey}`, e);
    }
  }
}

export async function addCompanyDocument(
  deps: DocumentDeps,
  input: { userId: string; kind: string; fileName: string; bytes: Uint8Array },
): Promise<CompanyDocument> {
  const company = await ownCompany(deps, input.userId);
  assertOwnerCanEdit(company);
  const document = createCompanyDocument({ companyId: company.id, kind: input.kind, fileName: input.fileName, bytes: input.bytes });
  if ((await deps.documents.listByCompany(company.id)).length >= MAX_COMPANY_DOCUMENTS) throw new DomainError('document.too_many');
  await deps.store.put(document.storageKey, input.bytes, document.contentType);
  try {
    await deps.documents.save(document);
  } catch (e) {
    await deleteStoredFiles(deps.store, [document]); // no row will ever point at these bytes
    throw e;
  }
  return document;
}

// A document that isn't the caller's is reported as missing, so the answer doesn't confirm that an id exists.
export async function removeCompanyDocument(deps: DocumentDeps, input: { userId: string; documentId: string }): Promise<void> {
  const company = await ownCompany(deps, input.userId);
  const document = await deps.documents.findById(input.documentId);
  if (!document || document.companyId !== company.id) throw new DomainError('document.not_found');
  assertOwnerCanEdit(company);
  // The file first, and a failure stops here: the row stays, so the owner still sees it and can try again.
  await deps.store.delete(document.storageKey);
  await deps.documents.delete(document.id);
}

// Only an admin or the owning company gets the bytes. Anyone else, and any id that doesn't exist, gets null.
export async function readCompanyDocument(
  deps: DocumentDeps,
  input: { documentId: string; viewer: { userId: string; isAdmin: boolean } },
): Promise<{ document: CompanyDocument; bytes: Uint8Array } | null> {
  const document = await deps.documents.findById(input.documentId);
  if (!document) return null;
  if (!input.viewer.isAdmin) {
    const company = await deps.companies.findByOwner(input.viewer.userId);
    if (company?.id !== document.companyId) return null;
  }
  const bytes = await deps.store.get(document.storageKey);
  return bytes ? { document, bytes } : null;
}

// Rows first, then files; each failure is logged and never thrown, because the decision that led here is already saved.
// If the rows can't be deleted the files stay too, so no row points at bytes that are gone; nothing counts as purged.
export async function purgeCompanyDocuments(deps: DocumentDeps, companyId: string): Promise<CompanyDocument[]> {
  let files: CompanyDocument[];
  try {
    files = await deps.documents.listByCompany(companyId);
    await deps.documents.deleteByCompany(companyId);
  } catch (e) {
    console.error(`[company-documents] could not delete the records of company ${companyId}`, e);
    return [];
  }
  await deleteStoredFiles(deps.store, files);
  return files;
}
