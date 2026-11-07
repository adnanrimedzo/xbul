'use client';

import type React from 'react';
import { useActionState, useState, useSyncExternalStore } from 'react';
import { authClient } from '@/app/_lib/auth-client';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from '@/app/_components/ui/button';

type SignInState = (ActionResult & { email?: string }) | null;
export type Provider = 'google' | 'microsoft';
const PROVIDER_LABEL: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft' };
// The providers' own marks, as their branding guidelines ask for on sign-in buttons.
const PROVIDER_LOGO: Record<Provider, React.ReactNode> = {
  google: (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.2-3.9 7.1-9.6 7.1-16.9z" />
      <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2.2 1.5-5 2.4-8.7 2.4-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  ),
  microsoft: (
    <svg aria-hidden="true" viewBox="0 0 21 21" className="size-[18px]">
      <path fill="#F25022" d="M0 0h10v10H0z" />
      <path fill="#7FBA00" d="M11 0h10v10H11z" />
      <path fill="#00A4EF" d="M0 11h10v10H0z" />
      <path fill="#FFB900" d="M11 11h10v10H11z" />
    </svg>
  ),
};

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

export function SignInForm({ providers, providerFailed }: { providers: Provider[]; providerFailed: boolean }) {
  const [state, formAction, pending] = useActionState(sendLink, null);
  const [redirecting, setRedirecting] = useState(false);
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
  async function continueWith(provider: Provider) {
    setRedirecting(true);
    // On success the browser leaves for the provider; errorCallbackURL brings a refused sign-in back here.
    const { error } = await authClient.signIn.social({ provider, callbackURL: '/onboarding', errorCallbackURL: '/sign-in' }).catch(() => ({ error: true }));
    if (error) setRedirecting(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {providerFailed && (
        <p role="alert" className="alert">
          We couldn&apos;t sign you in with that account. Try again, or use an email link instead.
        </p>
      )}
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
      {providers.length > 0 && (
        <>
          <p className="flex items-center gap-3 text-sm text-ink/60 before:h-px before:flex-1 before:bg-ink/15 after:h-px after:flex-1 after:bg-ink/15">
            or continue with
          </p>
          <div className="flex flex-wrap gap-3">
            {providers.map((provider) => (
              <Button key={provider} variant="ghost" type="button" disabled={!hydrated || redirecting} onClick={() => continueWith(provider)} className="flex-1">
                {PROVIDER_LOGO[provider]}
                {PROVIDER_LABEL[provider]}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
