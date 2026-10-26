'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/app/_components/ui/button';
import { findGarmentAction } from './actions';

// Mockup .findbar: a white 2px frame around the input and the orange FIND. It sits on the denim hero.
export function FindGarmentForm() {
  const [state, formAction, pending] = useActionState(findGarmentAction, null);
  return (
    <div className="relative mt-[22px] w-[min(560px,100%)]">
      <form action={formAction} className="flex border-2 border-paper bg-paper [&>button]:px-[22px] [&>button]:py-0 [&>button]:text-[13px]">
        <label className="flex-1">
          <span className="sr-only">Garment link</span>
          <input
            name="url"
            type="text"
            inputMode="url"
            required
            placeholder="Paste a garment link — guess.com, zara.com, liujo.com…"
            className="w-full border-0 p-3.5 text-[13px] normal-case outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <Button variant="cta" type="submit" disabled={pending}>
          Find
        </Button>
      </form>
      {/* The live region is always in the DOM, so screen readers announce the text when it appears. */}
      <div role="status" className="text-right text-[12px] text-paper">
        {state?.notFound && (
          <p className="mt-3">
            No mill has tagged this garment yet.{' '}
            <Link href="/add" className="font-semibold underline">
              Are you the mill? Add it →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
