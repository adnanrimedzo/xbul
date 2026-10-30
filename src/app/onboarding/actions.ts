'use server';

import { redirect } from 'next/navigation';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { createSupplierRepositories, registerCompany } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireViewer } from '@/server/viewer';

export type OnboardingValues = { companyName: string; city: string; country: string; contactEmail: string; phone: string; website: string };

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
    companyName: text('companyName'),
    city: text('city'),
    country: text('country'),
    contactEmail: text('contactEmail'),
    phone: text('phone'),
    website: text('website'),
  };

  const { db } = await getContainer();
  try {
    await registerCompany(createSupplierRepositories(db), {
      name: values.companyName,
      city: values.city,
      country: values.country,
      ownerUserId: viewer.userId,
      contact: { email: values.contactEmail, phone: values.phone, website: values.website },
    });
  } catch (e) {
    return { ...toActionError(e), values };
  }
  redirect('/add'); // outside the try: redirect() works by throwing
}
