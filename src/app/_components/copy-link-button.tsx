'use client';

import { useState } from 'react';
import { defineMessages } from '@/i18n/locales';
import { useMessages } from '@/i18n/client';
import { Button } from './ui/button';

const COPY = defineMessages({
  en: { copied: 'Copied', failed: 'Copy failed', copiedStatus: 'Link copied to the clipboard.', failedStatus: 'Could not copy the link.' },
  tr: { copied: 'Kopyalandı', failed: 'Kopyalanamadı', copiedStatus: 'Link panoya kopyalandı.', failedStatus: 'Link kopyalanamadı.' },
});

// The url is built on the server, which knows the public base url.
export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const { t } = useMessages(COPY);

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
        {state === 'copied' ? t.copied : state === 'failed' ? t.failed : label}
      </Button>
      <span role="status" className="sr-only">
        {state === 'copied' ? t.copiedStatus : state === 'failed' ? t.failedStatus : ''}
      </span>
    </>
  );
}
