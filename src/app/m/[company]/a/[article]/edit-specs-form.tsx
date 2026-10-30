'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@/app/_components/ui/button';
import type { ArticleSpecs } from '@/modules/supplier';
import { editArticleSpecsAction } from './actions';

const label = 'flex flex-col gap-1.5 text-[11px] font-semibold';
const input = 'border border-ink p-2.5 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent';

export function EditSpecsForm({ articleId, specs }: { articleId: string; specs: ArticleSpecs }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(editArticleSpecsAction, null);
  const formId = useId();

  return (
    <div>
      <Button variant="ghost" type="button" aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
        Edit specs
      </Button>
      <div id={formId}>
        {open && (
          // Remounting on a saved change resets the uncontrolled fields to the new values.
          <form key={JSON.stringify(specs)} action={formAction} className="mt-3 grid max-w-[640px] grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <input type="hidden" name="articleId" value={articleId} />
            <label className={label}>
              Weight
              <input name="weight" maxLength={60} placeholder="12.5 oz or 240 g/m²" defaultValue={specs.weight ?? ''} className={input} />
            </label>
            <label className={label}>
              Composition
              <input name="composition" maxLength={120} defaultValue={specs.composition ?? ''} className={input} />
            </label>
            <label className={label}>
              Finish
              <input name="finish" maxLength={80} defaultValue={specs.finish ?? ''} className={input} />
            </label>
            <label className={label}>
              MOQ
              <input name="moq" maxLength={60} placeholder="1,000 m or 500 pieces" defaultValue={specs.moq ?? ''} className={input} />
            </label>
            <label className={label}>
              Lead time (weeks)
              <input name="leadTimeWeeks" type="number" min={0} max={52} step={1} inputMode="numeric" defaultValue={specs.leadTimeWeeks ?? ''} className={input} />
            </label>
            <div className="col-span-full flex flex-col gap-3">
              {state && !state.ok && (
                <p role="alert" className="border border-accent px-3 py-2 text-[12px] normal-case">
                  {state.error}
                </p>
              )}
              {state?.ok && (
                <p role="status" className="border border-ink px-3 py-2 text-[12px] normal-case">
                  Specs saved.
                </p>
              )}
              <Button variant="cta" type="submit" disabled={pending} className="self-start">
                Save specs
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
