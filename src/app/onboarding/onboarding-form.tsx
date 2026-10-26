'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { completeOnboardingAction } from './actions';

const label = 'flex flex-col gap-1.5 text-[11px] font-semibold';
const input = 'border border-ink p-2.5 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent';
const roleOption =
  'flex flex-1 cursor-pointer items-center gap-2 border border-ink px-3 py-2.5 text-[12px] font-semibold has-checked:bg-ink has-checked:text-paper';

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, null);
  const values = state?.values; // after a failed submit React resets the form to these defaults

  return (
    // The mill fields show through CSS (no state), so the form works before hydration and survives a reset.
    <form action={formAction} className="group flex flex-col gap-4">
      <fieldset className="flex gap-2 max-[760px]:flex-col">
        <legend className="mb-1.5 text-[11px] font-semibold">I am</legend>
        <label className={roleOption}>
          <input type="radio" name="role" value="mill" required defaultChecked={values?.role === 'mill'} className="size-4 accent-accent" />
          I&apos;m at a mill
        </label>
        <label className={roleOption}>
          <input type="radio" name="role" value="agent" required defaultChecked={values?.role === 'agent'} className="size-4 accent-accent" />
          I&apos;m an agent
        </label>
      </fieldset>
      <label className={label}>
        Your name
        <input name="displayName" required autoComplete="name" defaultValue={values?.displayName} className={input} />
      </label>
      <div className="hidden flex-col gap-4 group-has-[input[value=mill]:checked]:flex">
        <label className={label}>
          Company name
          <input name="companyName" autoComplete="organization" defaultValue={values?.companyName} className={input} />
        </label>
        <label className={label}>
          City
          <input name="city" autoComplete="address-level2" defaultValue={values?.city} className={input} />
        </label>
        <label className={label}>
          Country
          <input name="country" autoComplete="country" placeholder="TR" defaultValue={values?.country} className={input} />
        </label>
      </div>
      {state && !state.ok && (
        <p role="alert" className="border border-accent px-3 py-2 text-[12px] normal-case">
          {state.error}
        </p>
      )}
      <Button variant="cta" type="submit" disabled={pending} className="self-start">
        Continue
      </Button>
    </form>
  );
}
