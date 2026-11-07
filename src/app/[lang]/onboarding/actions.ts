'use server';

import { localePath } from '@/i18n/locales';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { actionLang } from '@/i18n/action';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { COMPANY_KINDS, createSupplierRepositories, registerCompany } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireViewer } from '@/server/viewer';
import { DomainError } from '@/shared/domain/errors';

export type OnboardingValues = { kind: string; companyName: string; city: string; country: string; contactEmail: string; phone: string; website: string };

// A failed submit echoes what was typed: React resets the form after an action, and the supplier would lose its fields.
// Lengths, the country code and the contact details are the domain's (they have messages).
export async function completeOnboardingAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult & { values?: OnboardingValues }> {
  const viewer = await requireViewer();
  const text = (name: keyof OnboardingValues) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const values: OnboardingValues = {
    kind: text('kind'),
    companyName: text('companyName'),
    city: text('city'),
    country: text('country'),
    contactEmail: text('contactEmail'),
    phone: text('phone'),
    website: text('website'),
  };

  const kind = z.enum(COMPANY_KINDS).safeParse(values.kind);
  if (!kind.success) return { ...toActionError(new DomainError('company.kind_invalid'), await actionLang()), values };

  const { db } = await getContainer();
  let slug: string;
  try {
    ({ slug } = await registerCompany(createSupplierRepositories(db), {
      kind: kind.data,
      name: values.companyName,
      city: values.city,
      country: values.country,
      ownerUserId: viewer.userId,
      contact: { email: values.contactEmail, phone: values.phone, website: values.website },
    }));
  } catch (e) {
    return { ...toActionError(e, await actionLang()), values };
  }
  redirect(localePath(await actionLang(), `/m/${slug}/registration`)); // outside the try: redirect() works by throwing
}
