'use client';

import { useEffect } from 'react';
import { Button } from '@/app/_components/ui/button';
import './globals.css';

// The root layout queries the database for the signed-in viewer, so an outage skips error.tsx and lands here. Next renders this as
// its own document, without the layout's fonts or body classes, so it sets its own.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-paper px-5 pt-7 pb-10 text-[13px] tracking-[0.01em] text-ink uppercase">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Something went wrong</h1>
        <p className="mt-3 text-[12px] normal-case">xbul can&apos;t load right now. Please try again in a moment.</p>
        <Button variant="cta" type="button" onClick={() => retry()} className="mt-[18px]">
          Try again
        </Button>
      </body>
    </html>
  );
}
