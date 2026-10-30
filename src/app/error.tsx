'use client';

import { useEffect } from 'react';
import { Button } from '@/app/_components/ui/button';

// What shows when something nobody planned for fails, such as the database or file storage being down (a row action throws instead
// of returning an error message). It says nothing about the cause: Next gives the client only a digest, which matches the server log.
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page">
      <h1 className="page-title">Something went wrong</h1>
      <p className="mt-3 mb-6">That didn&apos;t work. Try again in a moment.</p>
      <Button variant="cta" type="button" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
