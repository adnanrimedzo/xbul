'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { withdrawClaim } from '@/modules/claims';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';

const GENERIC = 'Something went wrong. Please try again.';

export async function withdrawClaimAction(claimId: string): Promise<ActionResult> {
  const { company } = await requireMill(); // never from the caller; the use case checks the claim is this mill's
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: GENERIC };

  const { claims } = await getContainer();
  try {
    await withdrawClaim({ claims }, { companyId: company.id, claimId });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/', 'layout'); // the mill page, the garment page, the article page and the home grid
  return { ok: true, data: undefined };
}
