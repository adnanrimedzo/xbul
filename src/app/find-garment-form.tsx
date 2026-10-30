'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { findGarmentAction } from './actions';

export function FindGarmentForm() {
  const [state, formAction, pending] = useActionState(findGarmentAction, null);
  return (
    <div className="mt-8 w-full max-w-[640px]">
      <form action={formAction} role="search" className="flex flex-col gap-2 rounded-[1.75rem] border border-white/30 bg-ink/70 p-2 backdrop-blur-sm sm:flex-row sm:rounded-full">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Product link</span>
          <input
            name="url"
            type="text"
            inputMode="url"
            required
            placeholder="Paste a product link"
            className="h-12 w-full rounded-full bg-transparent px-4 font-mono text-[15px] text-white placeholder:text-white/70"
          />
        </label>
        <Button variant="onDark" type="submit" disabled={pending}>
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
          <p className="text-sm">No sign-up needed.</p>
        )}
      </div>
    </div>
  );
}
