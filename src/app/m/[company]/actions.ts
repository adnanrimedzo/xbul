'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { withdrawClaim } from '@/modules/claims';
import { updateCompanyContact } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';

const GENERIC = 'Something went wrong. Please try again.';

export async function withdrawClaimAction(claimId: string): Promise<ActionResult> {
  const { company } = await requireMill(); // never from the caller; the use case checks the claim is this supplier's
  if (!z.uuid().safeParse(claimId).success) return { ok: false, error: GENERIC };

  const { claims } = await getContainer();
  try {
    await withdrawClaim({ claims }, { companyId: company.id, claimId });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/', 'layout'); // the company page, the product page, the code page and the home grid
  return { ok: true, data: undefined };
}

// Blank fields clear a detail; whether at least one remains, and what a valid one looks like, are the domain's (they have messages).
const contactSchema = z.object({ email: z.string().optional(), phone: z.string().optional(), website: z.string().optional() });

export async function updateContactAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { userId } = await requireMill(); // never from the form: the use case finds the company by its owner
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { companies } = await getContainer();
  try {
    await updateCompanyContact({ companies }, { userId, contact: parsed.data });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath('/', 'layout'); // the company page, the product pages and the code pages all show it
  return { ok: true, data: undefined };
}
