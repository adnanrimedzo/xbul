import type { Metadata } from 'next';
import { alternates } from '@/app/_lib/seo';
import { pageMessages } from '@/i18n/server';
import { TERMS } from './messages';

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await pageMessages(TERMS);
  return { title: t.title, description: t.description, alternates: alternates(lang, '/terms') };
}

export default async function TermsPage() {
  const { t } = await pageMessages(TERMS);
  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      <div className="mt-8 flex max-w-[70ch] flex-col gap-6">
        {t.sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="section-title">{title}</h2>
            <p className="mt-2">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
