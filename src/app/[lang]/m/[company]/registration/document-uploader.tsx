'use client';

import { unstable_rethrow } from 'next/navigation';
import { useActionState, useId } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { ActionResult } from '@/app/_lib/action-result';
import { errorMessage } from '@/app/_lib/error-messages';
import { useMessages } from '@/i18n/client';
import type { DocumentKind } from '@/modules/supplier';
import { MAX_UPLOAD_BYTES } from '@/shared/domain/uploaded-file';
import { uploadCompanyDocumentAction } from './actions';
import { REGISTRATION } from './messages';

// A file over the limit is turned back here, before it is sent: the server refuses it too, but a body past the
// server action limit fails the whole request instead of answering.
export function DocumentUploader({ tr }: { tr: boolean }) {
  const { t, lang } = useMessages(REGISTRATION);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult | null, form: FormData): Promise<ActionResult> => {
    const file = form.get('file');
    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) return { ok: false, error: errorMessage('evidence.too_large', lang) };
    try {
      return await uploadCompanyDocumentAction(prev, form);
    } catch (e) {
      unstable_rethrow(e); // an expired session redirects to sign-in, which isn't a failed upload
      console.error('[registration] upload failed', e);
      return { ok: false, error: errorMessage('generic', lang) }; // the request itself failed: say so here, don't unmount the page
    }
  }, null);
  const hintId = useId();
  const kinds = Object.keys(t.kinds) as DocumentKind[];
  const hints = t.kindHints[tr ? 'TR' : 'elsewhere'];

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-3">
      <label className="field-label">
        {t.documentType}
        <select name="kind" required defaultValue="" disabled={pending} className="field">
          <option value="" disabled>{t.choose}</option>
          {kinds.map((k) => (
            <option key={k} value={k}>{t.kinds[k]}</option>
          ))}
        </select>
      </label>
      <label className="field-label">
        {t.file}
        <input
          type="file"
          name="file"
          required
          accept="application/pdf,image/jpeg,image/png"
          aria-describedby={hintId}
          disabled={pending}
          className="field file:mr-3 file:cursor-pointer file:rounded-control file:border file:border-line file:bg-surface file:px-3 file:py-1 file:font-semibold"
        />
      </label>
      <p id={hintId} className="text-sm text-muted">{t.fileHint}</p>
      {state && !state.ok && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
      <Button variant="ghost" type="submit" disabled={pending} className="self-start">
        {t.upload}
      </Button>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">{t.whichDocument}</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          {kinds.map((k) => (
            <div key={k} className="contents">
              <dt className="font-semibold">{t.kinds[k]}</dt>
              <dd className="text-muted">{hints[k]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </form>
  );
}
