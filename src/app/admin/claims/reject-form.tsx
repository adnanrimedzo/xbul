'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { rejectReviewAction } from './actions';

// One review's rejection: the reason is what the supplier reads when it comes back to try again.
export function RejectForm({ claimId }: { claimId: string }) {
  const [state, formAction, pending] = useActionState(rejectReviewAction.bind(null, claimId), null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold">
          Reason
          <input
            name="note"
            required
            maxLength={500}
            className="w-[260px] max-w-full border border-ink p-2 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent"
          />
        </label>
        <Button variant="ghost" type="submit" disabled={pending}>
          Reject
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="border border-accent px-2 py-1 text-[11px] normal-case">
          {state.error}
        </p>
      )}
    </form>
  );
}
