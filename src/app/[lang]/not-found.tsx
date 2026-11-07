import { LinkButton } from '@/app/_components/ui/button';
import { defineMessages } from '@/i18n/locales';
import { pageMessages } from '@/i18n/server';

const NOT_FOUND = defineMessages({
  en: { title: 'Not found', body: "This page doesn't exist, or it has been removed.", home: 'Back to xbul.io' },
  tr: { title: 'Sayfa bulunamadı', body: 'Bu sayfa yok ya da kaldırılmış.', home: 'xbul.io ana sayfasına dönün' },
});

// Rendered inside the root layout, so a missing page keeps the site chrome. It gets no params, so the language comes from the root param.
export default async function NotFound() {
  const { t, href } = await pageMessages(NOT_FOUND);
  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <p className="mt-3 mb-6">{t.body}</p>
      <LinkButton variant="cta" href={href('/')}>
        {t.home}
      </LinkButton>
    </div>
  );
}
