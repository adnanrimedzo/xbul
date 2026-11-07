import type { CompanyRepository, CompanyDocumentRepository } from '../domain/repositories';

// Private file storage for registration documents. Keys are built by createCompanyDocument, never from user input.
// Same shape as the claims EvidenceStore, so the container passes its evidenceStore in.
export interface DocumentStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export type DocumentDeps = { companies: CompanyRepository; documents: CompanyDocumentRepository; store: DocumentStore };
