import type { ClaimRepository, EvidenceRepository } from '../domain/repositories';

// Private file storage for the documents behind an original claim. Keys are built by createEvidence, never from user input.
export interface EvidenceStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export type EvidenceDeps = { claims: ClaimRepository; evidence: EvidenceRepository; store: EvidenceStore };
