'use client';

import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { rejectReviewAction } from './actions';

// One review's rejection: the reason is what the supplier reads when it comes back to try again.
export function RejectForm({ claimId }: { claimId: string }) {
  const [state, formAction, pending] = useActionState(rejectReviewAction.bind(null, claimId), null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="field-label">
          Reason
          <input
            name="note"
            required
            maxLength={500}
            className="field w-[260px]! max-w-full"
          />
        </label>
        <Button variant="ghost" type="submit" disabled={pending}>
          Reject
        </Button>
      </div>
      {state && !state.ok && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
