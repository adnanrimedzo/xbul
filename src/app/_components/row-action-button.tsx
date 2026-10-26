'use client';

import { useActionState } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from './ui/button';

// One row's button, with its own pending state and its own error. The server page binds the row's id into the action.
export function RowActionButton({ action, label }: { action: () => Promise<ActionResult>; label: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null>(action, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <Button variant="ghost" type="submit" disabled={pending}>
        {label}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="border border-accent px-2 py-1 text-[11px] normal-case">
          {state.error}
        </p>
      )}
    </form>
  );
}
