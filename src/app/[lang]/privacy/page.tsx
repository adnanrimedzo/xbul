import type { Metadata } from 'next';
import { alternates } from '@/app/_lib/seo';
import { pageMessages } from '@/i18n/server';
import { PRIVACY } from './messages';

export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await pageMessages(PRIVACY);
  return { title: t.title, description: t.description, alternates: alternates(lang, '/privacy') };
}

export default async function PrivacyPage() {
  const { t } = await pageMessages(PRIVACY);
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
