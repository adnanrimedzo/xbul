'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { approveClaimReview, rejectClaimReview } from '@/modules/claims';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';

const GENERIC = 'Something went wrong. Please try again.';

// requireAdmin comes first in both: nothing below runs for anyone else. The admin recorded with the decision is the viewer, never the caller.
export async function approveReviewAction(claimId: string): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: GENERIC };

  const { claims, evidence, evidenceStore } = await getContainer();
  try {
    await approveClaimReview({ claims, evidence, store: evidenceStore }, { claimId, adminUserId: userId });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/', 'layout'); // the queue, the product page's badge, and the supplier's own pages
  return { ok: true, data: undefined };
}

export async function rejectReviewAction(claimId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: GENERIC };

  const note = form.get('note');
  const { claims, evidence, evidenceStore } = await getContainer();
  try {
    // The domain judges the reason (1–500 characters once trimmed); a missing field is as empty as a blank one.
    await rejectClaimReview({ claims, evidence, store: evidenceStore }, { claimId, adminUserId: userId, note: typeof note === 'string' ? note : '' });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/', 'layout'); // the queue, and the supplier's page where the reason shows
  return { ok: true, data: undefined };
}
