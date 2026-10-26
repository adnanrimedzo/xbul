'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { completeOnboarding, createProfileRepository } from '@/modules/identity';
import { createSupplierRepositories, registerCompany } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireViewer } from '@/server/viewer';

export type OnboardingValues = { role: string; displayName: string; companyName: string; city: string; country: string };

const formSchema = z.object({
  role: z.enum(['mill', 'agent']),
  displayName: z.string().trim(),
  companyName: z.string().trim(),
  city: z.string().trim(),
  country: z.string().trim(),
});

// A failed submit echoes what was typed: React resets the form after an action, and a mill would lose its fields.
export async function completeOnboardingAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult & { values?: OnboardingValues }> {
  const viewer = await requireViewer();
  const text = (name: keyof OnboardingValues) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : '';
  };
  const values: OnboardingValues = { role: text('role'), displayName: text('displayName'), companyName: text('companyName'), city: text('city'), country: text('country') };
  const parsed = formSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: 'Choose mill or agent, then enter your name.', values };

  const { role, displayName, companyName, city, country } = parsed.data;
  const { db } = await getContainer();
  try {
    // One transaction, so a profile that fails to save cannot leave a company behind that locks the mill out.
    await db.transaction((tx) =>
      completeOnboarding(
        {
          profiles: createProfileRepository(tx),
          registerCompany: (company) => registerCompany(createSupplierRepositories(tx), company),
        },
        { userId: viewer.userId, displayName, role, company: role === 'mill' ? { name: companyName, city, country } : undefined },
      ),
    );
  } catch (e) {
    return { ...toActionError(e), values };
  }
  redirect(role === 'mill' ? '/add' : '/'); // outside the transaction and the try: redirect() works by throwing
}
