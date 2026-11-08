'use client';

import { useActionState, useId, type InputHTMLAttributes } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { ActionResult } from '@/app/_lib/action-result';
import { useMessages } from '@/i18n/client';
import type { CertificationScheme } from '@/modules/supplier';
import { REGISTRATION } from './messages';
import type { RegistrationValues } from './registration-values';

const BANDS = ['1-9', '10-49', '50-249', '250+'];
const CERT_ROWS = [0, 1, 2];
const legend = 'mb-3 section-title';

type SaveAction = (prev: (ActionResult & { values?: RegistrationValues }) | null, form: FormData) => Promise<ActionResult & { values?: RegistrationValues }>;

// The owner's form, and the admin's edit form with its own action. `locked` disables every field at once through the
// fieldset: the owner can't change the details under review or after a decision.
export function RegistrationForm({ action, saved, tr, taxLabel, locked }: { action: SaveAction; saved: RegistrationValues; tr: boolean; taxLabel: keyof (typeof REGISTRATION)['en']['taxId']; locked: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const { t } = useMessages(REGISTRATION);
  const naceHintId = useId();
  const v = state?.values ?? saved; // after a failed save React resets the form to these defaults

  const input = (name: string, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="field-label">
      {label}
      <input name={name} defaultValue={v[name] ?? ''} className="field" {...props} />
    </label>
  );
  const address = (name: string, label: string) => (
    <label className="field-label">
      {label}
      <textarea name={name} rows={2} maxLength={300} defaultValue={v[name] ?? ''} className="field" />
    </label>
  );

  return (
    // Remounting when the saved values change resets the uncontrolled fields to them.
    <form key={JSON.stringify(v)} action={formAction} className="max-w-[720px]">
      <fieldset disabled={locked} className="flex flex-col gap-8">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className={legend}>{t.legalIdentity}</legend>
          <div className="sm:col-span-2">{input('legalName', t.legalName, { maxLength: 160, autoComplete: 'organization' })}</div>
          {input('taxId', t.taxId[taxLabel], { maxLength: 40 })}
          {tr && input('taxOffice', t.taxOffice, { maxLength: 120 })}
          {input('registryNumber', t.registryNumber, { maxLength: 40 })}
          {tr && input('mersisNumber', t.mersisNumber, { maxLength: 30, inputMode: 'numeric' })}
          {tr && input('industryRegistryNumber', t.industryRegistryNumber, { maxLength: 120 })}
          {input('lei', t.lei, { maxLength: 30 })}
          <div className="sm:col-span-2">{address('registeredAddress', t.registeredAddress)}</div>
        </fieldset>

        <fieldset>
          <legend className={legend}>{t.facility}</legend>
          {address('facilityAddress', t.facilityAddress)}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={legend}>{t.activities}</legend>
          {input('naceCodes', t.naceCodes, { placeholder: '13.20, 13.30', 'aria-describedby': naceHintId })}
          <p id={naceHintId} className="text-sm text-muted">{t.naceHint}</p>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className={legend}>{t.sizeAndCapacity}</legend>
          <label className="field-label">
            {t.employees}
            <select name="employees" defaultValue={v.employees ?? ''} className="field">
              <option value="">{t.notGiven}</option>
              {BANDS.map((b) => (
                <option key={b} value={b}>{b.replace('-', '–')}</option>
              ))}
            </select>
          </label>
          {input('monthlyCapacity', t.monthlyCapacity, { maxLength: 120, placeholder: '300,000 m' })}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className={legend}>{t.certifications}</legend>
          {CERT_ROWS.map((i) => (
            <div key={i} className="grid gap-4 sm:grid-cols-3">
              <label className="field-label">
                {t.certScheme(i + 1)}
                <select name={`cert${i}Scheme`} defaultValue={v[`cert${i}Scheme`] ?? ''} className="field">
                  <option value="">{t.notGiven}</option>
                  {(Object.keys(t.schemes) as CertificationScheme[]).map((s) => (
                    <option key={s} value={s}>{t.schemes[s]}</option>
                  ))}
                </select>
              </label>
              {input(`cert${i}Number`, t.certNumber(i + 1), { maxLength: 60 })}
              {input(`cert${i}ValidUntil`, t.certValidUntil(i + 1), { type: 'date' })}
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend className={legend}>{t.openSupplyHub}</legend>
          {input('openSupplyHubId', t.openSupplyHubId, { maxLength: 20 })}
        </fieldset>

        {!locked && (
          <div className="flex flex-col gap-3">
            {state && !state.ok && (
              <p role="alert" className="alert">
                {state.error}
              </p>
            )}
            {state?.ok && (
              <p role="status" className="font-semibold">
                {t.saved}
              </p>
            )}
            <Button variant="cta" type="submit" disabled={pending} className="self-start">
              {t.save}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
