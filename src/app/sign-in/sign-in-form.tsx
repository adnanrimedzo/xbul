'use client';

import { useActionState, useSyncExternalStore } from 'react';
import { authClient } from '@/app/_lib/auth-client';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/app/_components/ui/button';

type SignInState = (ActionResult & { email?: string }) | null;

async function sendLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim();
  try {
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/onboarding' });
    if (!error) return { ok: true, data: undefined };
  } catch (e) {
    console.error('[sign-in] network error', e);
  }
  // Rate-limited, a rejected address or a mail failure: nothing the visitor can fix beyond trying again. Echo the email,
  // because React resets the form after an action.
  return { ok: false, error: "We couldn't send the link, so please try again in a minute.", email };
}

// false on the server and while hydrating, true afterwards.
const subscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

export function SignInForm() {
  const [state, formAction, pending] = useActionState(sendLink, null);
  // Until hydrated the form is inert: submitting it natively would put the email in the URL.
  const hydrated = useHydrated();

  if (state?.ok) {
    return (
      <div role="status">
        <h2 className="section-title">Check your email</h2>
        <p className="mt-2">We sent you a sign-in link. It works for 10 minutes.</p>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="field-label">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          disabled={!hydrated}
          defaultValue={state?.ok === false ? state.email : undefined}
          className="field disabled:opacity-40"
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      <Button variant="cta" type="submit" disabled={!hydrated || pending} className="self-start">
        Send link
      </Button>
    </form>
  );
}
