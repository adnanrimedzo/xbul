'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actionLang } from '@/i18n/action';
import { errorMessage } from '@/app/_lib/error-messages';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { addEvidence, MAX_EVIDENCE_BYTES, removeEvidence, submitClaimForReview } from '@/modules/claims';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { DomainError } from '@/shared/domain/errors';


// The company comes from the viewer, never from the caller; the use cases check the claim or file is that company's.
async function evidenceDeps() {
  const { claims, evidence, evidenceStore } = await getContainer();
  return { claims, evidence, store: evidenceStore };
}

export async function uploadEvidenceAction(claimId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { company } = await requireMill();
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: errorMessage('generic', await actionLang()) };

  const file = form.get('file');
  if (!(file instanceof File)) return toActionError(new DomainError('evidence.type_invalid'), await actionLang()); // no file at all
  // The size is known without reading the file, so an oversized one costs nothing.
  if (file.size > MAX_EVIDENCE_BYTES) return toActionError(new DomainError('evidence.too_large'), await actionLang());

  try {
    await addEvidence(await evidenceDeps(), { companyId: company.id, claimId, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath(`/verify/${claimId}`);
  return { ok: true, data: undefined };
}

export async function removeEvidenceAction(claimId: string, evidenceId: string): Promise<ActionResult> {
  const { company } = await requireMill();
  if (!z.uuid().safeParse(claimId).success || !z.uuid().safeParse(evidenceId).success) return { ok: false, error: errorMessage('generic', await actionLang()) };

  try {
    await removeEvidence(await evidenceDeps(), { companyId: company.id, evidenceId });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath(`/verify/${claimId}`);
  return { ok: true, data: undefined };
}

export async function submitForReviewAction(claimId: string): Promise<ActionResult> {
  const { company } = await requireMill();
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: errorMessage('generic', await actionLang()) };

  try {
    await submitClaimForReview(await evidenceDeps(), { companyId: company.id, claimId });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath(`/verify/${claimId}`);
  revalidatePath('/admin/claims'); // the new entry in the queue
  revalidatePath(`/m/${company.slug}`); // the tile now says Under review
  return { ok: true, data: undefined };
}
