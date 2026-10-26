'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { verifyOriginalClaim } from '@/modules/claims';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';

const GENERIC = 'Something went wrong. Please try again.';

export async function verifyClaimAction(claimId: string): Promise<ActionResult> {
  await requireAdmin(); // first: nothing below runs for anyone else
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: GENERIC };

  const { claims } = await getContainer();
  let productId: string;
  try {
    ({ productId } = await verifyOriginalClaim({ claims }, claimId));
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/admin/claims');
  revalidatePath(`/p/${productId}`); // the garment page's badge turns to Verified
  return { ok: true, data: undefined };
}
