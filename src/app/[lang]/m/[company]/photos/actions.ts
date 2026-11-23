'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { errorMessage } from '@/app/_lib/error-messages';
import { actionLang } from '@/i18n/action';
import {
  deleteSupplierPhoto, MAX_PHOTO_BYTES, publishSupplierPhoto, unpublishSupplierPhoto, uploadSupplierPhoto,
  type GateDecision, type GateReason,
} from '@/modules/photos';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { DomainError } from '@/shared/domain/errors';

// The company always comes from the viewer, never from the form; the use cases check the photo is that company's.
async function deps() {
  const { photoModel, evidenceStore, supplierPhotos, photoChecks, articles } = await getContainer();
  if (!photoModel) throw new DomainError('photo.ai_unavailable');
  return { model: photoModel, store: evidenceStore, photos: supplierPhotos, checks: photoChecks, articles };
}

function refresh(slug: string) {
  revalidatePath(`/m/${slug}/photos`);
  revalidatePath(`/m/${slug}`); // the public gallery
}

export async function uploadSupplierPhotoAction(form: FormData): Promise<ActionResult<{ decision: GateDecision; reason: GateReason | null }>> {
  const { company } = await requireMill();
  const file = form.get('photo');
  if (!(file instanceof File)) return toActionError(new DomainError('photo.type_invalid'), await actionLang());
  if (file.size > MAX_PHOTO_BYTES) return toActionError(new DomainError('photo.too_large'), await actionLang());
  try {
    const r = await uploadSupplierPhoto(await deps(), { companyId: company.id, bytes: new Uint8Array(await file.arrayBuffer()) });
    if (r.decision !== 'rejected') refresh(company.slug);
    return { ok: true, data: { decision: r.decision, reason: r.reason } };
  } catch (e) {
    return toActionError(e, await actionLang());
  }
}

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
};

export async function publishSupplierPhotoAction(photoId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { company } = await requireMill();
  if (!z.uuid().safeParse(photoId).success) return { ok: false, error: errorMessage('photo.not_found', await actionLang()) };
  try {
    const { photos, articles } = await deps();
    await publishSupplierPhoto({ photos, articles }, {
      companyId: company.id,
      photoId,
      articleId: text(form, 'articleId') || null,
      tags: {
        category: text(form, 'category'),
        productType: text(form, 'productType'),
        colors: form.getAll('colors').filter((c): c is string => typeof c === 'string'),
        title: text(form, 'title'),
        construction: text(form, 'construction'),
        pattern: text(form, 'pattern'),
        twillRatio: text(form, 'twillRatio'),
        twillDirection: text(form, 'twillDirection'),
        denim: text(form, 'denim') || null,
        dye: text(form, 'dye'),
      },
    });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  refresh(company.slug);
  return { ok: true, data: undefined };
}

export async function unpublishSupplierPhotoAction(photoId: string): Promise<ActionResult> {
  const { company } = await requireMill();
  if (!z.uuid().safeParse(photoId).success) return { ok: false, error: errorMessage('photo.not_found', await actionLang()) };
  try {
    await unpublishSupplierPhoto(await deps(), { companyId: company.id, photoId });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  refresh(company.slug);
  return { ok: true, data: undefined };
}

export async function deleteSupplierPhotoAction(photoId: string): Promise<ActionResult> {
  const { company } = await requireMill();
  if (!z.uuid().safeParse(photoId).success) return { ok: false, error: errorMessage('photo.not_found', await actionLang()) };
  try {
    await deleteSupplierPhoto(await deps(), { companyId: company.id, photoId });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  refresh(company.slug);
  return { ok: true, data: undefined };
}
