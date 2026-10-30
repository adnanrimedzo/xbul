'use client';

import { unstable_rethrow } from 'next/navigation';
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
    } catch (e) {
      unstable_rethrow(e); // an expired session redirects to sign-in, which isn't a failed upload
      console.error('[verify] upload failed', e);
      return { ok: false, error: FAILED }; // the request itself failed (a body past the limit, a dropped connection): say so here, don't unmount the page
    }
  }, null);
  const [tooLarge, setTooLarge] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hintId = useId();
  const error = tooLarge ? errorMessage('evidence.too_large') : state && !state.ok ? state.error : null;

  return (
    <form ref={formRef} action={formAction} className="flex max-w-[640px] flex-col gap-2">
      <label className="field-label">
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
          className="field file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-ink file:px-3 file:py-1 file:font-semibold"
        />
      </label>
      <p id={hintId} className="text-sm text-muted">
        PDF, JPG or PNG, up to {maxFiles} files of {maxBytes / 1024 / 1024} MB each.
      </p>
      {pending && (
        <p role="status">
          Uploading…
        </p>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
    </form>
  );
}
