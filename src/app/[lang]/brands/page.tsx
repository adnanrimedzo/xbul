import type { Metadata } from 'next';
import Link from 'next/link';
import { alternates, jsonLd } from '@/app/_lib/seo';
import { pageLang, pageMessages } from '@/i18n/server';
import { getContainer } from '@/server/container';
import { BRANDS, brandSlug } from './brands';
import { BRANDS_COPY } from './messages';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await pageLang();
  const t = BRANDS_COPY[lang];
  return { title: { absolute: t.indexMetaTitle }, description: t.indexDescription, alternates: alternates(lang, '/brands'), openGraph: { title: t.indexMetaTitle, description: t.indexDescription } };
}

export default async function BrandsIndex() {
  const [{ config }, { t, lang, href }] = await Promise.all([getContainer(), pageMessages(BRANDS_COPY)]);
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.indexTitle,
    itemListElement: BRANDS.map((b, i) => ({ '@type': 'ListItem', position: i + 1, name: t.title(b.name), url: `${config.baseUrl}${href(`/brands/${brandSlug(b.name)}`)}` })),
  };
  return (
    <div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(list) }} />
      <p className="eyebrow">{t.brands}</p>
      <h1 className="page-title mt-3 max-w-[22ch]">{t.indexTitle}</h1>
      <p className="mt-4 max-w-[65ch] text-lg text-muted">{t.indexIntro}</p>
      <ul className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {BRANDS.map((b) => (
          <li key={b.name} className="bg-bg">
            <Link href={href(`/brands/${brandSlug(b.name)}`)} className="group flex h-full flex-col gap-3 p-6 transition-colors duration-150 hover:bg-surface">
              <span className="font-display text-3xl font-medium tracking-[-0.04em]">{b.name}</span>
              <span className="text-sm text-muted">
                {b.group ? `${b.group} · ` : ''}
                {b.country[lang]}
              </span>
              <span className="mt-auto text-sm font-medium group-hover:underline">{t.title(b.name)} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
