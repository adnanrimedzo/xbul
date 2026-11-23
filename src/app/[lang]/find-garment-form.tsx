'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CameraIcon } from '@/app/_components/photo/photo-dropzone';
import { Button } from '@/app/_components/ui/button';
import { useMessages } from '@/i18n/client';
import { findGarmentAction } from './actions';
import { HOME } from './home-messages';

// photoSearch: buyers may search with a photo here (the model is available and it has been switched on).
export function FindGarmentForm({ photoSearch = false }: { photoSearch?: boolean }) {
  const { t, href } = useMessages(HOME);
  const [state, formAction, pending] = useActionState(findGarmentAction, null);
  return (
    <div className="mt-10 w-full max-w-[600px]">
      <form action={formAction} role="search" className="flex flex-col gap-2 rounded-control border border-line bg-bg p-1.5 transition-colors duration-150 has-[input:focus-visible]:border-muted sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.linkLabel}</span>
          <input
            name="url"
            type="text"
            inputMode="url"
            required
            placeholder={t.placeholder}
            className="h-12 w-full rounded-control bg-transparent px-3 font-mono text-[15px] placeholder:text-muted"
          />
        </label>
        {/* After the input in tab order, so the input stays the first stop in the search box. */}
        {photoSearch && (
          <Link
            href={href('/photo')}
            aria-label={t.photoSearch}
            title={t.photoSearch}
            className="inline-flex size-12 shrink-0 items-center justify-center self-end rounded-control text-muted transition-colors duration-150 hover:text-fg max-sm:hidden"
          >
            <CameraIcon className="size-5" />
          </Link>
        )}
        <Button variant="cta" type="submit" disabled={pending}>
          {t.find}
        </Button>
      </form>
      {/* The live region is always in the DOM, so screen readers announce the text when it appears. */}
      <div role="status" className="mt-4">
        {state?.notFound ? (
          <p>
            {t.notFound}{' '}
            <Link href={href('/add')} className="link font-semibold">
              {t.addIt}
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted">{t.noSignUp}</p>
        )}
      </div>
      {/* Outside the live region, so it isn't announced or replaced when "not found" shows. */}
      {photoSearch && (
        <p className="mt-2 text-sm">
          <Link href={href('/photo')} className="link">
            {t.orPhoto}
          </Link>
        </p>
      )}
    </div>
  );
}
