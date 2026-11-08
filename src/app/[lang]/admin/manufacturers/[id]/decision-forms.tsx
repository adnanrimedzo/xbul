'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { ActionResult } from '@/app/_lib/action-result';

// A decision that needs a note, which the owner reads: asking for changes, or rejecting. The page binds the company id.
export function NoteDecisionForm({ action, label, submit }: { action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>; label: string; submit: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <label className="field-label w-full">
        {label}
        <textarea name="note" required maxLength={1000} rows={2} className="field" />
      </label>
      <Button variant="ghost" type="submit" disabled={pending}>
        {submit}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
