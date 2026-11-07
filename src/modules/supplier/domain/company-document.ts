import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { MAX_UPLOAD_BYTES, safeFileName, sniffFileType, type UploadType } from '@/shared/domain/uploaded-file';
import type { DocumentKind } from './registration';

export type CompanyDocument = Readonly<{
  id: string;
  companyId: string;
  kind: DocumentKind;
  fileName: string;
  contentType: UploadType;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
}>;

export const MAX_COMPANY_DOCUMENTS = 10;

const KINDS: readonly string[] = [
  'tax_certificate', 'registry_extract', 'signature_circular', 'industry_registry',
  'capacity_report', 'certificate', 'facility_photo', 'other',
] satisfies DocumentKind[];

export function createCompanyDocument(
  input: { companyId: string; kind: string; fileName: string; bytes: Uint8Array },
  now: Date = new Date(),
): CompanyDocument {
  if (!KINDS.includes(input.kind)) throw new DomainError('document.kind_invalid');
  if (input.bytes.length > MAX_UPLOAD_BYTES) throw new DomainError('evidence.too_large');
  const contentType = sniffFileType(input.bytes);
  if (!contentType) throw new DomainError('evidence.type_invalid');
  const id = newId();
  return Object.freeze({
    id,
    companyId: input.companyId,
    kind: input.kind as DocumentKind,
    fileName: safeFileName(input.fileName, contentType),
    contentType,
    sizeBytes: input.bytes.length,
    storageKey: `company-docs/${input.companyId}/${id}`,
    createdAt: now,
  });
}
