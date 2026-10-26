'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { sendSignInLinkAction } from './actions';

export function SignInForm() {
  const [state, formAction, pending] = useActionState(sendSignInLinkAction, null);

  if (state?.ok) {
    return (
      <div role="status">
        <h2 className="mb-2 text-[20px] font-semibold">Check your email</h2>
        <p className="text-[12px] leading-normal text-[#333] normal-case">We sent you a sign-in link. It works for 10 minutes.</p>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-[11px] font-semibold">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="border border-ink p-2.5 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent"
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="border border-accent px-3 py-2 text-[12px] normal-case">
          {state.error}
        </p>
      )}
      <Button variant="cta" type="submit" disabled={pending} className="self-start">
        Send link
      </Button>
    </form>
  );
}
