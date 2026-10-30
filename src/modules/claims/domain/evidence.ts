import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';

export type EvidenceType = 'application/pdf' | 'image/jpeg' | 'image/png';

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
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const FILE_NAME_MAX = 120;

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((b, i) => bytes[i] === b);

// The type comes from the file's own first bytes. Neither its name nor the type the browser claimed is trusted.
export function sniffEvidenceType(bytes: Uint8Array): EvidenceType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}

// What the uploader called the file, for display only: the last path part, without control or direction-override
// characters (a right-to-left override, U+202E, can reorder a name so that ".exe" reads as ".pdf"). It never reaches a path.
const cleanFileName = (raw: string): string =>
  Array.from(raw.slice(Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\')) + 1).replace(/[\p{Cc}\p{Cf}]/gu, '').trim())
    .slice(0, FILE_NAME_MAX)
    .join('') || 'evidence';

export function createEvidence(input: { claimId: string; fileName: string; bytes: Uint8Array }, now: Date = new Date()): Evidence {
  if (input.bytes.length > MAX_EVIDENCE_BYTES) throw new DomainError('evidence.too_large');
  const contentType = sniffEvidenceType(input.bytes);
  if (!contentType) throw new DomainError('evidence.type_invalid');
  const id = newId();
  return Object.freeze({
    id,
    claimId: input.claimId,
    fileName: cleanFileName(input.fileName),
    contentType,
    sizeBytes: input.bytes.length,
    storageKey: `evidence/${input.claimId}/${id}`,
    createdAt: now,
  });
}
