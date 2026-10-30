'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { CompanyContact } from '@/modules/supplier';
import { updateContactAction } from './actions';

const label = 'flex flex-col gap-1.5 text-[11px] font-semibold';
const input = 'border border-ink p-2.5 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent';

export function EditContactForm({ contact }: { contact: CompanyContact }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateContactAction, null);
  const formId = useId();

  return (
    <div>
      <Button variant="ghost" type="button" aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
        Edit contact details
      </Button>
      <div id={formId}>
        {open && (
          // Remounting on a saved change resets the uncontrolled fields to the new values.
          <form key={JSON.stringify(contact)} action={formAction} className="mt-3 grid max-w-[640px] grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <label className={label}>
              Contact email
              <input name="email" type="email" maxLength={254} autoComplete="email" defaultValue={contact.email ?? ''} className={input} />
            </label>
            <label className={label}>
              Phone
              <input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={contact.phone ?? ''} className={input} />
            </label>
            <label className={`${label} col-span-full`}>
              Website
              <input name="website" inputMode="url" maxLength={2048} autoComplete="url" placeholder="example.com" defaultValue={contact.website ?? ''} className={input} />
            </label>
            <div className="col-span-full flex flex-col gap-3">
              {state && !state.ok && (
                <p role="alert" className="border border-accent px-3 py-2 text-[12px] normal-case">
                  {state.error}
                </p>
              )}
              {state?.ok && (
                <p role="status" className="border border-ink px-3 py-2 text-[12px] normal-case">
                  Contact saved.
                </p>
              )}
              <Button variant="cta" type="submit" disabled={pending} className="self-start">
                Save contact
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
