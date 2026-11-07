'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { completeOnboardingAction } from './actions';

const KINDS = [
  ['fabric_mill', 'We make fabric'],
  ['garment_maker', 'We make garments'],
] as const;

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, null);
  const values = state?.values; // after a failed submit React resets the form to these defaults

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-semibold">What does your company make?</legend>
        {KINDS.map(([value, text]) => (
          <label key={value} className="flex min-h-11 items-center gap-3">
            <input type="radio" name="kind" value={value} required defaultChecked={values?.kind === value} className="size-5 accent-fg" />
            {text}
          </label>
        ))}
      </fieldset>
      <label className="field-label">
        Company name
        <input name="companyName" autoComplete="organization" defaultValue={values?.companyName} className="field" />
      </label>
      <label className="field-label">
        City
        <input name="city" autoComplete="address-level2" defaultValue={values?.city} className="field" />
      </label>
      <label className="field-label">
        Country
        <input name="country" autoComplete="country" placeholder="Two-letter code" defaultValue={values?.country} className="field" />
      </label>
      <fieldset className="flex flex-col gap-4">
        <legend className="font-semibold">How buyers reach you (at least one)</legend>
        <p className="text-muted">These are shown publicly on your page.</p>
        <label className="field-label">
          Contact email
          <input name="contactEmail" type="email" maxLength={254} autoComplete="email" defaultValue={values ? values.contactEmail : defaultEmail} className="field" />
        </label>
        <label className="field-label">
          Phone
          <input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={values?.phone} className="field" />
        </label>
        <label className="field-label">
          Website
          <input name="website" inputMode="url" maxLength={2048} autoComplete="url" placeholder="example.com" defaultValue={values?.website} className="field" />
        </label>
      </fieldset>
      {state && !state.ok && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      <Button variant="cta" type="submit" disabled={pending} className="self-start">
        Continue
      </Button>
    </form>
  );
}
