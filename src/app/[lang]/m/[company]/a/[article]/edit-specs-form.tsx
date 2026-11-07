'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { ArticleSpecs } from '@/modules/supplier';
import { useMessages } from '@/i18n/client';
import { editArticleSpecsAction } from './actions';
import { EDIT_SPECS } from './edit-messages';

export function EditSpecsForm({ articleId, specs }: { articleId: string; specs: ArticleSpecs }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(editArticleSpecsAction, null);
  const formId = useId();
  const { t } = useMessages(EDIT_SPECS);

  return (
    <div>
      <Button variant="ghost" type="button" aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
        {t.edit}
      </Button>
      <div id={formId}>
        {open && (
          // Remounting on a saved change resets the uncontrolled fields to the new values.
          <form key={JSON.stringify(specs)} action={formAction} className="mt-4 grid max-w-[640px] gap-4 sm:grid-cols-2">
            <input type="hidden" name="articleId" value={articleId} />
            <label className="field-label">
              {t.weight}
              <input name="weight" maxLength={60} placeholder={t.weightPlaceholder} defaultValue={specs.weight ?? ''} className="field" />
            </label>
            <label className="field-label">
              {t.composition}
              <input name="composition" maxLength={120} defaultValue={specs.composition ?? ''} className="field" />
            </label>
            <label className="field-label">
              {t.finish}
              <input name="finish" maxLength={80} defaultValue={specs.finish ?? ''} className="field" />
            </label>
            <label className="field-label">
              {t.moq}
              <input name="moq" maxLength={60} placeholder={t.moqPlaceholder} defaultValue={specs.moq ?? ''} className="field" />
            </label>
            <label className="field-label">
              {t.leadTime}
              <input name="leadTimeWeeks" type="number" min={0} max={52} step={1} inputMode="numeric" defaultValue={specs.leadTimeWeeks ?? ''} className="field" />
            </label>
            <div className="col-span-full flex flex-col gap-3">
              {state && !state.ok && (
                <p role="alert" className="alert">
                  {state.error}
                </p>
              )}
              {state?.ok && (
                <p role="status" className="font-semibold">
                  {t.saved}
                </p>
              )}
              <Button variant="cta" type="submit" disabled={pending} className="self-start">
                {t.save}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
