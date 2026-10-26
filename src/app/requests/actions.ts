'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { markInquiryAnswered } from '@/modules/inquiry';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';

const GENERIC = 'Something went wrong. Please try again.';

export async function markAnsweredAction(inquiryId: string): Promise<ActionResult> {
  const { company } = await requireMill(); // never from the caller; the use case checks the inquiry is this mill's
  if (!z.uuid().safeParse(inquiryId).success) return { ok: false, error: GENERIC };

  const { inquiries } = await getContainer();
  try {
    await markInquiryAnswered({ inquiries }, { companyId: company.id, inquiryId });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/', 'layout'); // the row, and the nav's new-requests count
  return { ok: true, data: undefined };
}
