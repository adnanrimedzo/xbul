'use client';

import { useState } from 'react';
import { Button } from './ui/button';

// The url is built on the server, which knows the public base url.
export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed'); // insecure context or permission denied
    }
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <>
      <Button variant="ghost" type="button" onClick={copy}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}
      </Button>
      <span role="status" className="sr-only">
        {state === 'copied' ? 'Link copied to the clipboard.' : state === 'failed' ? 'Could not copy the link.' : ''}
      </span>
    </>
  );
}
