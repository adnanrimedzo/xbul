import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { MAX_UPLOAD_BYTES, safeFileName, sniffFileType, type UploadType } from '@/shared/domain/uploaded-file';

export type EvidenceType = UploadType;

export type Evidence = Readonly<{
  id: string;
  claimId: string;
  fileName: string;
  contentType: EvidenceType;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
}>;

export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_BYTES = MAX_UPLOAD_BYTES;
export const sniffEvidenceType = sniffFileType;

export function createEvidence(input: { claimId: string; fileName: string; bytes: Uint8Array }, now: Date = new Date()): Evidence {
  if (input.bytes.length > MAX_EVIDENCE_BYTES) throw new DomainError('evidence.too_large');
  const contentType = sniffEvidenceType(input.bytes);
  if (!contentType) throw new DomainError('evidence.type_invalid');
  const id = newId();
  return Object.freeze({
    id,
    claimId: input.claimId,
    fileName: safeFileName(input.fileName, contentType),
    contentType,
    sizeBytes: input.bytes.length,
    storageKey: `evidence/${input.claimId}/${id}`,
    createdAt: now,
  });
}
