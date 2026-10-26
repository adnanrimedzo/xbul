'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import type { ActionResult } from '@/app/_lib/action-result';
import { getContainer } from '@/server/container';

const email = z.string().trim().pipe(z.email());

export async function sendSignInLinkAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = email.safeParse(form.get('email'));
  if (!parsed.success) return { ok: false, error: 'Enter a valid email address.' };
  try {
    const { auth } = await getContainer();
    await auth.api.signInMagicLink({ body: { email: parsed.data, callbackURL: '/onboarding' }, headers: await headers() });
  } catch (e) {
    console.error('[sign-in] could not send the link', e); // rate limit or mail failure: nothing the visitor can fix
    return { ok: false, error: "We couldn't send the link, so please try again in a minute." };
  }
  return { ok: true, data: undefined };
}
