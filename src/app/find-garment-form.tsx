'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { findGarmentAction } from './actions';

export function FindGarmentForm() {
  const [state, formAction, pending] = useActionState(findGarmentAction, null);
  return (
    <div className="mt-10 w-full max-w-[600px]">
      <form action={formAction} role="search" className="flex flex-col gap-2 rounded-control border border-line bg-bg p-1.5 transition-colors duration-150 has-[input:focus-visible]:border-muted sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Product link</span>
          <input
            name="url"
            type="text"
            inputMode="url"
            required
            placeholder="Paste a product link"
            className="h-12 w-full rounded-control bg-transparent px-3 font-mono text-[15px] placeholder:text-muted"
          />
        </label>
        <Button variant="cta" type="submit" disabled={pending}>
          Find suppliers
        </Button>
      </form>
      {/* The live region is always in the DOM, so screen readers announce the text when it appears. */}
      <div role="status" className="mt-4">
        {state?.notFound ? (
          <p>
            No supplier has tagged this product yet.{' '}
            <Link href="/add" className="link font-semibold">
              Are you the supplier? Add it
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted">No sign-up needed.</p>
        )}
      </div>
    </div>
  );
}
