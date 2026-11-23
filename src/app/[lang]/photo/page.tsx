import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { alternates } from '@/app/_lib/seo';
import { OG_LOCALE } from '@/i18n/locales';
import { pageLang, pageMessages } from '@/i18n/server';
import { getContainer } from '@/server/container';
import { PHOTO_SEARCH } from './messages';
import { PhotoSearchForm } from './photo-search-form';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await pageLang();
  const t = PHOTO_SEARCH[lang];
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: alternates(lang, '/photo'),
    openGraph: { title: t.metaTitle, description: t.metaDescription, locale: OG_LOCALE[lang], url: alternates(lang, '/photo').canonical as string },
  };
}

export default async function PhotoSearchPage() {
  const [{ photoSearchPublic }, { t }] = await Promise.all([getContainer(), pageMessages(PHOTO_SEARCH)]);
  if (!photoSearchPublic) notFound(); // not launched here yet, or no AI
  return (
    <section className="page flex flex-col items-center text-center">
      <h1 className="page-title">{t.title}</h1>
      <p className="mt-3 max-w-[40ch] text-lg text-muted">{t.subtitle}</p>
      <PhotoSearchForm />
    </section>
  );
}
