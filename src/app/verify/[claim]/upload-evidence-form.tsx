'use client';

import { useActionState, useId, useRef, useState } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';
import { errorMessage } from '@/app/_lib/error-messages';
import { uploadEvidenceAction } from './actions';

const FAILED = 'Something went wrong. Please try again.';

// Sends a document as soon as one is chosen. A file over the limit is turned back here, before it is sent: the
// server refuses it too, but a body past the server action limit fails the whole request instead of answering.
export function UploadEvidenceForm({ claimId, maxBytes, maxFiles }: { claimId: string; maxBytes: number; maxFiles: number }) {
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, form: FormData): Promise<ActionResult> => {
    try {
      return await uploadEvidenceAction(claimId, prev, form);
    } catch {
      return { ok: false, error: FAILED }; // the request itself failed (a body past the limit, a dropped connection): say so here, don't unmount the page
    }
  }, null);
  const [tooLarge, setTooLarge] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hintId = useId();
  const error = tooLarge ? errorMessage('evidence.too_large') : state && !state.ok ? state.error : null;

  return (
    <form ref={formRef} action={formAction} className="flex max-w-[640px] flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-[11px] font-semibold">
        Add a document
        <input
          type="file"
          name="file"
          accept=".pdf,.jpg,.jpeg,.png"
          aria-describedby={hintId}
          disabled={pending}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            const big = file.size > maxBytes;
            setTooLarge(big);
            if (big) e.currentTarget.value = '';
            else formRef.current?.requestSubmit();
          }}
          className="border border-ink p-2.5 text-[12px] font-normal normal-case file:mr-3 file:border-0 file:bg-transparent file:font-semibold focus:outline-2 focus:outline-accent"
        />
      </label>
      <p id={hintId} className="text-[11px] text-muted normal-case">
        PDF, JPG or PNG, up to {maxFiles} files of {maxBytes / 1024 / 1024} MB each.
      </p>
      {pending && (
        <p role="status" className="text-[11px] normal-case">
          Uploading…
        </p>
      )}
      {error && (
        <p role="alert" className="border border-accent px-3 py-2 text-[12px] normal-case">
          {error}
        </p>
      )}
    </form>
  );
}
