'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { CompanyContact } from '@/modules/supplier';
import { updateContactAction } from './actions';

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
          <form key={JSON.stringify(contact)} action={formAction} className="mt-4 grid max-w-[640px] gap-4 sm:grid-cols-2">
            <label className="field-label">
              Contact email
              <input name="email" type="email" maxLength={254} autoComplete="email" defaultValue={contact.email ?? ''} className="field" />
            </label>
            <label className="field-label">
              Phone
              <input name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={contact.phone ?? ''} className="field" />
            </label>
            <label className="field-label col-span-full">
              Website
              <input name="website" inputMode="url" maxLength={2048} autoComplete="url" placeholder="example.com" defaultValue={contact.website ?? ''} className="field" />
            </label>
            <div className="col-span-full flex flex-col gap-3">
              {state && !state.ok && (
                <p role="alert" className="alert">
                  {state.error}
                </p>
              )}
              {state?.ok && (
                <p role="status" className="font-semibold">
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
