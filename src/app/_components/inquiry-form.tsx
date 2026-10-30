'use client';

import { useActionState, useId, useState } from 'react';
import { submitInquiryAction } from '@/app/_actions/submit-inquiry';
import { Button } from './ui/button';

const label = 'flex flex-col gap-1.5 text-[11px] font-semibold';
const input = 'border border-ink p-2.5 text-[12px] font-normal normal-case focus:outline-2 focus:outline-accent';

// The root is `display: contents`, so the button joins the parent's layout (a full-width CTA, or the right end of a
// row) and the open form wraps onto its own line.
export function InquiryForm(props: {
  companyId: string;
  companyName: string;
  productId?: string;
  articleId?: string;
  kind: 'swatch' | 'quote';
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(submitInquiryAction, null);
  const formId = useId();

  return (
    <div className="contents">
      <Button
        variant={props.kind === 'swatch' ? 'cta' : 'ghost'}
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen(!open)}
        className={props.kind === 'swatch' ? 'w-full' : undefined}
      >
        {props.label}
      </Button>
      <div id={formId} className="basis-full">
        {open &&
          (state?.ok ? (
            <p role="status" className="mt-3 border border-ink px-3 py-2 text-[12px] normal-case">
              Request sent to {props.companyName}.
            </p>
          ) : (
            <form action={formAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="companyId" value={props.companyId} />
              <input type="hidden" name="productId" value={props.productId ?? ''} />
              <input type="hidden" name="articleId" value={props.articleId ?? ''} />
              <input type="hidden" name="kind" value={props.kind} />
              <label className={label}>
                Your name
                <input name="buyerName" required maxLength={100} autoComplete="name" className={input} />
              </label>
              <label className={label}>
                Email
                <input name="buyerEmail" type="email" required maxLength={254} autoComplete="email" className={input} />
              </label>
              <label className={label}>
                Company
                <input name="buyerCompany" maxLength={120} autoComplete="organization" className={input} />
              </label>
              <label className={label}>
                Quantity (m)
                <input name="quantityMeters" type="number" min={1} max={1_000_000} step={1} inputMode="numeric" className={input} />
              </label>
              <label className={label}>
                Message
                <textarea name="message" rows={3} maxLength={2000} className={input} />
              </label>
              {/* Honeypot: invisible to people and screen readers, so only a bot fills it. */}
              <div aria-hidden="true" className="sr-only">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {state && !state.ok && (
                <p role="alert" className="border border-accent px-3 py-2 text-[12px] normal-case">
                  {state.error}
                </p>
              )}
              <Button variant="cta" type="submit" disabled={pending} className="self-start">
                Send request
              </Button>
            </form>
          ))}
      </div>
    </div>
  );
}
