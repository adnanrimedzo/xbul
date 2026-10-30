'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { completeOnboardingAction } from './actions';

const KINDS = [
  ['fabric_mill', 'We make fabric'],
  ['garment_maker', 'We make garments'],
] as const;
const label = 'flex flex-col gap-1.5 text-[11px] font-semibold';
const radio = 'flex items-center gap-2 text-[12px] font-normal';
const input = 'border border-ink p-2.5 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent';

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, null);
  const values = state?.values; // after a failed submit React resets the form to these defaults

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[11px] font-semibold">What does your company make?</legend>
        {KINDS.map(([value, text]) => (
          <label key={value} className={radio}>
            <input type="radio" name="kind" value={value} required defaultChecked={values?.kind === value} className="size-4 accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
            {text}
          </label>
        ))}
      </fieldset>
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
        <input name="country" autoComplete="country" placeholder="Two-letter code" defaultValue={values?.country} className={input} />
      </label>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-[11px] font-semibold">How buyers reach you (at least one)</legend>
        <p className="text-[12px] normal-case">These are shown publicly on your page.</p>
        <label className={label}>
          Contact email
          <input name="contactEmail" type="email" maxLength={254} autoComplete="email" defaultValue={values ? values.contactEmail : defaultEmail} className={input} />
        </label>
        <label className={label}>
          Phone
          <input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={values?.phone} className={input} />
        </label>
        <label className={label}>
          Website
          <input name="website" inputMode="url" maxLength={2048} autoComplete="url" placeholder="example.com" defaultValue={values?.website} className={input} />
        </label>
      </fieldset>
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
