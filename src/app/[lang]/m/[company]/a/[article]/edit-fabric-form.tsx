'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { useMessages } from '@/i18n/client';
import {
  CONSTRUCTIONS, DYES, FIBRES, FINISHES, PATTERNS, PATTERNS_BY_CONSTRUCTION, TWILL_DIRECTIONS, TWILL_RATIOS,
  type FabricSpec,
} from '@/shared/domain/taxonomy';
import { editArticleFabricAction } from './actions';
import { EDIT_FABRIC } from './fabric-messages';

function Select({ name, label, value, options, none }: { name: string; label: string; value: string; options: [string, string][]; none: string }) {
  return (
    <label className="field-label">
      {label}
      <select name={name} defaultValue={value} className="field">
        <option value="">{none}</option>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EditFabricForm({ articleId, fabric }: { articleId: string; fabric: FabricSpec | null }) {
  const [open, setOpen] = useState(false);
  const [construction, setConstruction] = useState<string>(fabric?.construction ?? '');
  const [state, formAction, pending] = useActionState(editArticleFabricAction, null);
  const formId = useId();
  const { t, lang } = useMessages(EDIT_FABRIC);
  const patterns = construction in PATTERNS_BY_CONSTRUCTION ? PATTERNS_BY_CONSTRUCTION[construction as keyof typeof PATTERNS_BY_CONSTRUCTION] : [];

  return (
    <div>
      <Button variant="ghost" type="button" aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
        {t.edit}
      </Button>
      <div id={formId}>
        {open && (
          // Remounting on a saved change resets the uncontrolled fields to the new values.
          <form key={JSON.stringify(fabric)} action={formAction} className="mt-4 grid max-w-[640px] gap-4 sm:grid-cols-2">
            <input type="hidden" name="articleId" value={articleId} />
            <h3 className="col-span-full font-semibold">{t.sheet}</h3>
            <label className="field-label">
              {t.construction}
              <select name="construction" value={construction} onChange={(e) => setConstruction(e.target.value)} className="field">
                <option value="">{t.none}</option>
                {Object.entries(CONSTRUCTIONS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name[lang]}
                  </option>
                ))}
              </select>
            </label>
            <Select key={construction} name="pattern" label={t.pattern} value={fabric?.pattern ?? ''} none={t.none} options={patterns.map((p) => [p, PATTERNS[p][lang]])} />
            <Select name="twillRatio" label={t.twillRatio} value={fabric?.twill?.ratio ?? ''} none={t.none} options={TWILL_RATIOS.map((r) => [r, r])} />
            <Select name="twillDirection" label={t.twillDirection} value={fabric?.twill?.direction ?? ''} none={t.none} options={Object.entries(TWILL_DIRECTIONS).map(([id, name]) => [id, name[lang]])} />
            <fieldset className="col-span-full grid gap-2 sm:grid-cols-2">
              <legend className="field-label">{t.fibres}</legend>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2">
                  <select name={`fibre${i}`} aria-label={`${t.fibre} ${i + 1}`} defaultValue={fabric?.fibres[i]?.code ?? ''} className="field">
                    <option value="">{t.none}</option>
                    {Object.entries(FIBRES).map(([code, f]) => (
                      <option key={code} value={code}>
                        {f.name[lang]} ({code})
                      </option>
                    ))}
                  </select>
                  <input name={`percent${i}`} type="number" min={1} max={100} step={1} inputMode="numeric" aria-label={`${t.fibre} ${i + 1} ${t.percent}`} defaultValue={fabric?.fibres[i]?.percent ?? ''} className="field w-24" />
                </div>
              ))}
            </fieldset>
            <div className="field-label">
              {t.weight}
              <div className="flex gap-2">
                <input name="weight" type="number" min={1} step="any" inputMode="decimal" aria-label={t.weight} defaultValue={fabric?.weightGsm ?? ''} className="field" />
                <select name="weightUnit" aria-label={t.weight} defaultValue="gsm" className="field w-28">
                  <option value="gsm">g/m²</option>
                  <option value="oz">oz/yd²</option>
                </select>
              </div>
            </div>
            <label className="field-label">
              {t.widthCm}
              <input name="widthCm" type="number" min={30} max={400} step={1} inputMode="numeric" defaultValue={fabric?.widthCm ?? ''} className="field" />
            </label>
            <Select name="dye" label={t.dye} value={fabric?.dye ?? ''} none={t.none} options={Object.entries(DYES).map(([id, name]) => [id, name[lang]])} />
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
              <legend className="field-label">{t.finishes}</legend>
              {Object.entries(FINISHES).map(([id, name]) => (
                <label key={id} className="flex items-center gap-2">
                  <input type="checkbox" name="finishes" value={id} defaultChecked={fabric?.finishes.includes(id as keyof typeof FINISHES) ?? false} />
                  {name[lang]}
                </label>
              ))}
            </fieldset>
            <div className="col-span-full flex flex-col gap-3">
              <p className="text-sm text-muted">{t.clearHint}</p>
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
