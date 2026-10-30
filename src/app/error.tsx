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
    <div className="px-5 pt-7 pb-10">
      <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Something went wrong</h1>
      <p className="mt-3 text-[12px] normal-case">That didn&apos;t work. Please try again in a moment.</p>
      <Button variant="cta" type="button" onClick={() => retry()} className="mt-[18px]">
        Try again
      </Button>
    </div>
  );
}
