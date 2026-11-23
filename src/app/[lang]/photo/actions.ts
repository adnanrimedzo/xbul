'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { clientIp, visitorHash } from '@/app/_lib/visitor-hash';
import { seenLabels } from '@/app/_components/photo/labels';
import { actionLang } from '@/i18n/action';
import { addCloseUp, buyerAttributes, checkBuyerPhoto, MAX_PHOTO_BYTES, type GateDecision, type GateReason, type Verdict } from '@/modules/photos';
import { getContainer } from '@/server/container';
import { DomainError } from '@/shared/domain/errors';

export type PhotoCheckAnswer = { id: string; decision: GateDecision; reason: GateReason | null; labels: string[] };

// The photo the page prepared, read only after its size is known to be sane (an oversized body costs nothing).
async function photoBytes(form: FormData): Promise<Uint8Array> {
  const file = form.get('photo');
  if (!(file instanceof File)) throw new DomainError('photo.type_invalid');
  if (file.size > MAX_PHOTO_BYTES) throw new DomainError('photo.too_large');
  return new Uint8Array(await file.arrayBuffer());
}

async function buyerDeps() {
  const { photoModel, photoSearchPublic, evidenceStore, photoChecks, config } = await getContainer();
  if (!photoModel || !photoSearchPublic) throw new DomainError('photo.ai_unavailable');
  const hash = visitorHash(clientIp(await headers()), config.authSecret, new Date());
  return { deps: { model: photoModel, store: evidenceStore, checks: photoChecks }, hash };
}

const labelsOf = async (v: Verdict, closeUp: Verdict | null = null) =>
  seenLabels(await actionLang(), { category: v.category, productType: v.productType, colors: v.colors, attributes: buyerAttributes(v, closeUp) });

// Public, like link search, and capped per visitor per day. The answer says what the photo shows before any search runs.
export async function checkPhotoAction(form: FormData): Promise<ActionResult<PhotoCheckAnswer>> {
  try {
    const bytes = await photoBytes(form);
    const { deps, hash } = await buyerDeps();
    const r = await checkBuyerPhoto(deps, { visitorHash: hash, bytes });
    return { ok: true, data: { id: r.id, decision: r.decision, reason: r.reason, labels: r.decision === 'rejected' ? [] : await labelsOf(r.verdict) } };
  } catch (e) {
    return toActionError(e, await actionLang());
  }
}

export async function addCloseUpAction(searchId: string, form: FormData): Promise<ActionResult<PhotoCheckAnswer>> {
  if (!z.uuid().safeParse(searchId).success) return toActionError(new DomainError('photo.not_found'), await actionLang());
  try {
    const bytes = await photoBytes(form);
    const { deps, hash } = await buyerDeps();
    const r = await addCloseUp(deps, { searchId, visitorHash: hash, bytes });
    const search = await deps.checks.findById(searchId);
    const labels = search ? await labelsOf(search.verdict, search.closeUp) : [];
    return { ok: true, data: { id: searchId, decision: r.decision, reason: r.reason, labels } };
  } catch (e) {
    return toActionError(e, await actionLang());
  }
}
