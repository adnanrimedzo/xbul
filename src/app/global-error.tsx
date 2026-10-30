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
      <body className="page min-h-full bg-white font-sans text-ink">
        <h1 className="page-title">Something went wrong</h1>
        <p className="mt-3 mb-6">xbul.io can&apos;t load right now. Try again in a moment.</p>
        <Button variant="cta" type="button" onClick={() => retry()}>
          Try again
        </Button>
      </body>
    </html>
  );
}
