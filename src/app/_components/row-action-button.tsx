'use client';

import { useActionState, useState } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { Button } from './ui/button';

// One row's button, with its own pending state and its own error. The server page binds the row's id into the action.
// With `confirmLabel`, the first click only arms the button and the second one (now reading confirmLabel) runs the action.
export function RowActionButton({ action, label, confirmLabel }: { action: () => Promise<ActionResult>; label: string; confirmLabel?: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null>(action, null);
  const [armed, setArmed] = useState(false);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button
        variant="ghost"
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirmLabel || armed) return;
          e.preventDefault();
          setArmed(true);
        }}
      >
        {armed ? confirmLabel : label}
      </Button>
      {state && !state.ok && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
