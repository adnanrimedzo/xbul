import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import type { PhotoTags } from './photo-tags';

export type SupplierPhotoStatus = 'draft' | 'published';

// A supplier's photo of its own product. Drafts carry the AI's suggested tags until the supplier approves them;
// only published photos of approved companies can be found by buyers.
export type SupplierPhoto = Readonly<{
  id: string;
  companyId: string;
  articleId: string | null;
  photoKey: string;
  status: SupplierPhotoStatus;
  tags: PhotoTags;
  embedding: readonly number[];
  embeddingModel: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}>;

export const MAX_COMPANY_PHOTOS = 200;
export const MAX_PHOTO_BATCH = 10;

export function createSupplierPhoto(
  input: { companyId: string; tags: PhotoTags; embedding: readonly number[]; embeddingModel: string },
  now: Date = new Date(),
): SupplierPhoto {
  const id = newId();
  return Object.freeze({
    id,
    companyId: input.companyId,
    articleId: null,
    photoKey: `supplier-photos/${input.companyId}/${id}`,
    status: 'draft',
    tags: input.tags,
    embedding: input.embedding,
    embeddingModel: input.embeddingModel,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  });
}

export function assertPhotoCapacity(count: number): void {
  if (count >= MAX_COMPANY_PHOTOS) throw new DomainError('photo.limit');
}

// Publishing and editing both take the reviewed tags; editing a published photo keeps it published.
export function publishPhoto(p: SupplierPhoto, tags: PhotoTags, articleId: string | null, now: Date = new Date()): SupplierPhoto {
  return Object.freeze({ ...p, tags, articleId, status: 'published', updatedAt: now, publishedAt: p.publishedAt ?? now });
}

export function editPhoto(p: SupplierPhoto, tags: PhotoTags, articleId: string | null, now: Date = new Date()): SupplierPhoto {
  return Object.freeze({ ...p, tags, articleId, updatedAt: now });
}

export function unpublishPhoto(p: SupplierPhoto, now: Date = new Date()): SupplierPhoto {
  return Object.freeze({ ...p, status: 'draft', updatedAt: now, publishedAt: null });
}
