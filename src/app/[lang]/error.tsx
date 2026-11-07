'use client';

import { useEffect } from 'react';
import { Button } from '@/app/_components/ui/button';
import { useMessages } from '@/i18n/client';
import { defineMessages } from '@/i18n/locales';

const ERROR = defineMessages({
  en: { title: 'Something went wrong', body: "That didn't work. Try again in a moment.", retry: 'Try again' },
  tr: { title: 'Bir sorun oluştu', body: 'Bu işlem gerçekleşmedi. Lütfen birazdan tekrar deneyin.', retry: 'Tekrar deneyin' },
});

// What shows when something nobody planned for fails, such as the database or file storage being down (a row action throws instead
// of returning an error message). It says nothing about the cause: Next gives the client only a digest, which matches the server log.
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useMessages(ERROR);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="mt-3 mb-6">{t.body}</p>
      <Button variant="cta" type="button" onClick={() => retry()}>
        {t.retry}
      </Button>
    </div>
  );
}
