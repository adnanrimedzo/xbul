import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/app/_components/ui/button';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { alternates, jsonLd } from '@/app/_lib/seo';
import { pageLang, pageMessages } from '@/i18n/server';
import { listRecentlyTagged } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { HOME } from '../../home-messages';
import { BRANDS, brandSlug, findBrand, TURKIYE_FACT } from '../brands';
import { BRANDS_COPY } from '../messages';

export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: brandSlug(b.name) }));
}

export async function generateMetadata({ params }: PageProps<'/[lang]/brands/[brand]'>): Promise<Metadata> {
  const [{ brand: slug }, lang] = await Promise.all([params, pageLang()]);
  const brand = findBrand(slug);
  if (!brand) return {};
  const t = BRANDS_COPY[lang];
  return {
    title: { absolute: t.metaTitle(brand.name) },
    description: t.metaDescription(brand.name),
    alternates: alternates(lang, `/brands/${slug}`),
    openGraph: { title: t.metaTitle(brand.name), description: t.metaDescription(brand.name) },
  };
}

export default async function BrandPage({ params }: PageProps<'/[lang]/brands/[brand]'>) {
  const { brand: slug } = await params;
  const brand = findBrand(slug);
  if (!brand) notFound();
  const [{ db, config }, { t, lang, href }] = await Promise.all([getContainer(), pageMessages(BRANDS_COPY)]);
  const tiles = await listRecentlyTagged(db, 12, brand.aliases);
  const home = HOME[lang];
  const b = brand.name;
  const url = (path: string) => `${config.baseUrl}${href(path)}`;
  const facts = [...brand.facts, TURKIYE_FACT];
  const faq = t.faq(b);

  const structured = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: url('/') },
        { '@type': 'ListItem', position: 2, name: t.brands, item: url('/brands') },
        { '@type': 'ListItem', position: 3, name: b, item: url(`/brands/${slug}`) },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      inLanguage: lang,
      mainEntity: [[t.title(b), t.answer(b)] as [string, string], ...faq].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: t.stepsTitle(b),
      inLanguage: lang,
      step: t.steps(b).map((text, i) => ({ '@type': 'HowToStep', position: i + 1, text })),
    },
  ];

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      <header className="px-5 pt-10 pb-12 sm:px-8 sm:pt-14">
        <nav aria-label={lang === 'tr' ? 'Sayfa yolu' : 'Breadcrumb'} className="text-sm text-muted">
          <Link href={href('/')} className="hover:text-fg">{t.home}</Link> / <Link href={href('/brands')} className="hover:text-fg">{t.brands}</Link> / <span className="text-fg">{b}</span>
        </nav>
        <p className="eyebrow mt-8">
          {t.eyebrow}
          {brand.group ? ` · ${brand.group}` : ''} · {brand.country[lang]}
        </p>
        <h1 className="page-title mt-3 max-w-[20ch]">{t.title(b)}</h1>
        <p className="mt-5 max-w-[65ch] text-lg">{t.answer(b)}</p>
        <LinkButton variant="cta" href={`${href('/')}#find`} className="mt-8">{t.findCta}</LinkButton>
      </header>

      <section aria-labelledby="facts-title" className="band grid lg:grid-cols-2">
        <div className="px-5 py-12 sm:px-8">
          <h2 id="facts-title" className="section-title">{t.factsTitle(b)}</h2>
          {brand.facts.length === 0 && <p className="mt-3 text-muted">{t.noFacts(b)}</p>}
          <ul className="mt-6 flex flex-col gap-6">
            {facts.map((f) => (
              <li key={f.en} className="border-l-2 border-accent pl-4">
                <p>{f[lang]}</p>
                {f.source && (
                  <p className="mt-1 text-sm text-muted">
                    {t.source}:{' '}
                    <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="link">{f.source.label}</a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-line bg-surface px-5 py-12 sm:px-8 lg:border-t-0 lg:border-l">
          <h2 className="section-title">{t.stepsTitle(b)}</h2>
          <ol className="mt-6 flex flex-col gap-4">
            {t.steps(b).map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="font-mono text-sm text-muted">0{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="products-title" className="band px-5 py-12 sm:px-8 sm:py-16">
        <h2 id="products-title" className="section-title mb-8">{t.productsTitle(b)}</h2>
        {tiles.length > 0 ? (
          <GarmentGrid>
            {tiles.map((tile) => {
              const tag = [tile.originals > 0 && home.madeIt(tile.originals), tile.equivalents > 0 && home.canMakeIt(tile.equivalents)].filter(Boolean).join(' · ') || home.tagged;
              return <GarmentTile key={tile.productId} tile={tile} href={href(`/p/${tile.productId}`)} tag={tag} />;
            })}
          </GarmentGrid>
        ) : (
          <p className="max-w-[65ch] text-muted">{t.noProducts(b)}</p>
        )}
      </section>

      <section aria-labelledby="faq-title" className="band px-5 py-12 sm:px-8 sm:py-16">
        <h2 id="faq-title" className="section-title">{t.faqTitle}</h2>
        <dl className="mt-6 max-w-[760px] border-t border-line">
          {faq.map(([q, a]) => (
            <div key={q} className="border-b border-line py-5">
              <dt className="font-medium">{q}</dt>
              <dd className="mt-2 text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="other-title" className="band px-5 py-12 sm:px-8">
        <h2 id="other-title" className="section-title">{t.otherBrands}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {BRANDS.filter((o) => o.name !== b).map((o) => (
            <li key={o.name}>
              <Link href={href(`/brands/${brandSlug(o.name)}`)} className="inline-flex min-h-11 items-center rounded-control border border-line px-4 text-sm transition-colors duration-150 hover:bg-surface">
                {o.name}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-xs text-muted">{t.disclaimer(b)}</p>
      </section>
    </article>
  );
}
