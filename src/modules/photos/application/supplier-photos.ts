import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { COMPANY_DAILY_LIMIT, dayAgo } from '../domain/photo-check';
import { normalizeTags, type PhotoTagsInput } from '../domain/photo-tags';
import { assertPhotoCapacity, createSupplierPhoto, publishPhoto, unpublishPhoto, type SupplierPhoto } from '../domain/supplier-photo';
import { suggestedTags, type GateReason } from '../domain/verdict';
import { analysePhoto } from './analyse-photo';
import type { SupplierPhotoDeps } from './ports';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SupplierUploadResult =
  | { decision: 'rejected'; reason: GateReason | null }
  | { decision: 'accepted' | 'unclear'; reason: GateReason | null; photo: SupplierPhoto };

// A rejection is an answer, not an error: the supplier sees why, and nothing is stored.
export async function uploadSupplierPhoto(
  deps: SupplierPhotoDeps,
  input: { companyId: string; bytes: Uint8Array },
  now: Date = new Date(),
): Promise<SupplierUploadResult> {
  assertPhotoCapacity(await deps.photos.countByCompany(input.companyId));
  if ((await deps.checks.countSince({ companyId: input.companyId }, dayAgo(now))) >= COMPANY_DAILY_LIMIT) throw new DomainError('photo.daily_limit');
  const a = await analysePhoto(deps.model, input.bytes);
  await deps.checks.save({
    id: newId(), source: 'supplier', companyId: input.companyId, visitorHash: null, decision: a.decision, reason: a.reason,
    verdict: a.verdict, closeUp: null, photoKey: null, embedding: null, embeddingModel: deps.model.embeddingModel, createdAt: now,
  });
  if (a.decision === 'rejected') return { decision: 'rejected', reason: a.reason };

  const photo = createSupplierPhoto({ companyId: input.companyId, tags: suggestedTags(a.verdict), embedding: a.embedding, embeddingModel: deps.model.embeddingModel }, now);
  await deps.store.put(photo.photoKey, input.bytes, 'image/jpeg');
  try {
    await deps.photos.save(photo);
  } catch (e) {
    await deleteFile(deps, photo.photoKey); // no row will ever point at these bytes
    throw e;
  }
  return { decision: a.decision, reason: a.reason, photo };
}

// Another company's photo is reported as missing, so the answer doesn't confirm that an id exists.
async function ownedPhoto(deps: Pick<SupplierPhotoDeps, 'photos'>, companyId: string, photoId: string): Promise<SupplierPhoto> {
  const photo = await deps.photos.findById(photoId);
  if (!photo || photo.companyId !== companyId) throw new DomainError('photo.not_found');
  return photo;
}

async function ownArticle(deps: Pick<SupplierPhotoDeps, 'articles'>, companyId: string, articleId: string | null): Promise<string | null> {
  if (!articleId) return null;
  if (!UUID.test(articleId)) throw new DomainError('photo.article_invalid'); // never let a malformed id reach the uuid column
  const article = await deps.articles.findById(articleId);
  if (!article || article.companyId !== companyId) throw new DomainError('photo.article_invalid');
  return article.id;
}

// Approving a draft and editing a published photo are the same step: the reviewed tags go live.
export async function publishSupplierPhoto(
  deps: Pick<SupplierPhotoDeps, 'photos' | 'articles'>,
  input: { companyId: string; photoId: string; tags: PhotoTagsInput; articleId: string | null },
  now: Date = new Date(),
): Promise<SupplierPhoto> {
  const photo = await ownedPhoto(deps, input.companyId, input.photoId);
  const tags = normalizeTags(input.tags);
  const published = publishPhoto(photo, tags, await ownArticle(deps, input.companyId, input.articleId), now);
  await deps.photos.save(published);
  return published;
}

export async function unpublishSupplierPhoto(deps: Pick<SupplierPhotoDeps, 'photos'>, input: { companyId: string; photoId: string }): Promise<void> {
  await deps.photos.save(unpublishPhoto(await ownedPhoto(deps, input.companyId, input.photoId)));
}

// The row first, so the photo leaves search and the image route at once; then the file, whose failure is logged with
// its key for cleaning up by hand (no lifecycle rule covers supplier photos).
export async function deleteSupplierPhoto(deps: Pick<SupplierPhotoDeps, 'photos' | 'store'>, input: { companyId: string; photoId: string }): Promise<void> {
  const photo = await ownedPhoto(deps, input.companyId, input.photoId);
  await deps.photos.delete(photo.id);
  await deleteFile(deps, photo.photoKey);
}

async function deleteFile(deps: Pick<SupplierPhotoDeps, 'store'>, key: string): Promise<void> {
  try {
    await deps.store.delete(key);
  } catch (e) {
    console.error(`[photos] could not delete ${key}`, e);
  }
}

// Who may see a photo's bytes: anyone once it is published by an approved company, otherwise its owner or an admin.
export async function readSupplierPhoto(
  deps: Pick<SupplierPhotoDeps, 'photos' | 'store'>,
  photoId: string,
  canSee: (photo: SupplierPhoto) => Promise<{ public: boolean } | null>,
): Promise<{ bytes: Uint8Array; public: boolean } | null> {
  const photo = await deps.photos.findById(photoId);
  const access = photo && (await canSee(photo));
  if (!photo || !access) return null;
  const bytes = await deps.store.get(photo.photoKey);
  return bytes ? { bytes, public: access.public } : null;
}
