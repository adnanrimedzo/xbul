import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { brandSlug, findBrand } from '@/app/[lang]/brands/brands';
import { CopyLinkButton } from '@/app/_components/copy-link-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Chip } from '@/app/_components/ui/chip';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { VerifiedExplanation, VerifiedInline } from '@/app/_components/ui/verified';
import { alternates, jsonLd } from '@/app/_lib/seo';
import { localePath, OG_LOCALE, type Locale } from '@/i18n/locales';
import { pageMessages } from '@/i18n/server';
import { getProductPageView, type ClaimGroup, type ClaimView, type ProductPageView } from '@/modules/discovery';
import type { ArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { describeFabric, formatHs, PRODUCT_TYPES } from '@/shared/domain/taxonomy';
import { PRODUCT } from './messages';

type T = (typeof PRODUCT)['en'];

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await getContainer();
  return (await getProductPageView(db, id)) ?? notFound();
});

const moq = (s: ArticleSpecs) => (s.moq === null ? null : `MOQ ${s.moq}`);
const leadTime = (t: T, s: ArticleSpecs) => (s.leadTimeWeeks === null ? null : t.weeks(s.leadTimeWeeks));

const madeBy = (t: T, label: string, c: ClaimView | undefined) => c && t.madeBy(label, c.company.name, c.article?.code ?? null);

export async function generateMetadata({ params }: PageProps<'/[lang]/p/[id]'>): Promise<Metadata> {
  const [{ product, fabric, garment }, { config }, { t, lang, href }] = await Promise.all([loadView((await params).id), getContainer(), pageMessages(PRODUCT)]);
  const equivalents = fabric.equivalents.length + garment.equivalents.length;
  const parts = [
    madeBy(t, t.fabricBy, fabric.originals[0]),
    madeBy(t, t.garmentBy, garment.originals[0]),
    equivalents > 0 && t.equivalents(equivalents),
  ].filter(Boolean);

  const path = `/p/${product.id}`;
  const description = parts.join(' · ') || t.metaFallback(product.brand, product.name);
  // Link previews keep the short "brand — name" title; the search result title carries the question people search for.
  const ogTitle = `${product.brand} — ${product.name}`;
  return {
    title: t.metaTitle(product.brand, product.name),
    description,
    alternates: alternates(lang, path),
    openGraph: {
      siteName: 'xbul.io',
      type: 'website',
      locale: OG_LOCALE[lang],
      title: ogTitle,
      description,
      url: `${config.baseUrl}${href(path)}`,
      images: product.imageUrl ? [product.imageUrl] : [],
    },
  };
}

// schema.org Product, with only the suppliers that say "We made this" as its manufacturers, plus the breadcrumb trail.
function structuredData({ product, fabric, garment }: ProductPageView, baseUrl: string, lang: Locale, t: T) {
  const abs = (path: string) => `${baseUrl}${localePath(lang, path)}`;
  const url = abs(`/p/${product.id}`);
  const makers = new Map([...fabric.originals, ...garment.originals].map((c) => [c.company.id, c.company]));
  const brand = findBrand(brandSlug(product.brand));
  const crumbs = [
    { name: t.home, item: abs('/') },
    ...(brand ? [{ name: brand.name, item: abs(`/brands/${brandSlug(brand.name)}`) }] : []),
    { name: product.name, item: url },
  ];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      brand: { '@type': 'Brand', name: product.brand },
      ...(product.imageUrl && { image: product.imageUrl }),
      url,
      ...(makers.size > 0 && {
        manufacturer: [...makers.values()].map((c) => ({
          '@type': 'Organization',
          name: c.name,
          address: { '@type': 'PostalAddress', addressLocality: c.city, addressCountry: c.country },
          url: abs(`/m/${c.slug}`),
        })),
      }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c })),
    },
  ];
}

function ClaimCard({ claim, testId, t, lang, href }: { claim: ClaimView; testId: string; t: T; lang: Locale; href: (path: string) => string }) {
  const { company, article, kind, status, note } = claim;
  const specs = article && [kind === 'original' && t.code(article.code), ...(kind !== 'original' ? [] : article.fabric ? describeFabric(article.fabric, lang).slice(0, 3) : [article.specs.weight, article.specs.composition]), moq(article.specs), leadTime(t, article.specs)];
  return (
    <li data-testid={testId} className="card flex flex-col gap-3">
      <div>
        <h3 className="section-title">
          <Link href={href(`/m/${company.slug}`)} className="hover:underline">
            {company.name}
          </Link>
        </h3>
        <p className="text-muted">
          {company.city}, {company.country}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ClaimTag kind={kind} />
        {status === 'verified' && <VerifiedInline />}
      </div>
      {note && <p>{note}</p>}
      {specs && (
        <div className="flex flex-wrap gap-1.5">
          {specs
            .filter((chip) => typeof chip === 'string')
            .map((chip) => (
              <Chip key={chip}>{chip}</Chip>
            ))}
        </div>
      )}
      <SupplierContact contact={company.contact} />
    </li>
  );
}

// One side of the product: who made the fabric, or who made the garment. Nothing to show means no section.
function SupplierSection({ title, testId, group: { originals, equivalents }, t, lang, href }: { title: string; testId: string; group: ClaimGroup; t: T; lang: Locale; href: (path: string) => string }) {
  if (originals.length === 0 && equivalents.length === 0) return null;
  return (
    <section data-testid={testId} aria-labelledby={`${testId}-title`} className="panel">
      <h2 id={`${testId}-title`} className="section-title px-2 pt-2 pb-4">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {originals.map((c) => (
          <ClaimCard key={c.claimId} claim={c} testId="original-claim" t={t} lang={lang} href={href} />
        ))}
        {equivalents.map((c) => (
          <ClaimCard key={c.claimId} claim={c} testId="equivalent-claim" t={t} lang={lang} href={href} />
        ))}
      </ul>
    </section>
  );
}

export default async function ProductPage({ params }: PageProps<'/[lang]/p/[id]'>) {
  const [view, { config }, { t, lang, href }] = await Promise.all([loadView((await params).id), getContainer(), pageMessages(PRODUCT)]);
  const { product, fabric, garment } = view;
  const host = new URL(product.sourceUrl).hostname.replace(/^www\./, '');
  const shareUrl = `${config.baseUrl}${href(`/p/${product.id}`)}`;
  const anyVerified = [...fabric.originals, ...garment.originals].some((c) => c.status === 'verified');

  return (
    <div className="page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData(view, config.baseUrl, lang, t)) }} />
      <Link href={href('/')} className="link">
        {t.back}
      </Link>
      <div className="mt-4 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-6">
          <GarmentImage src={product.imageUrl} alt={`${product.brand} — ${product.name}`} credit={{ host, href: product.sourceUrl }} className="aspect-[4/3] rounded-card lg:aspect-[4/5]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="mb-2">
            <p className="font-mono text-sm text-muted">{product.brand}</p>
            <h1 className="page-title mt-1">{product.name}</h1>
            {product.type && (
              <p className="mt-1 text-muted">
                {PRODUCT_TYPES[product.type].name[lang]} · {formatHs(PRODUCT_TYPES[product.type].hs)}
              </p>
            )}
            <p className="mt-2">
              {product.composition && <span className="text-muted">{product.composition} · </span>}
              <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="link font-mono text-sm">
                {t.viewOn(host)}
              </a>
            </p>
          </div>

          <SupplierSection title={t.whoFabric} testId="fabric-suppliers" group={fabric} t={t} lang={lang} href={href} />
          <SupplierSection title={t.whoGarment} testId="garment-suppliers" group={garment} t={t} lang={lang} href={href} />
          {anyVerified && <VerifiedExplanation className="px-2 py-4 sm:px-6" />}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-2 pt-5 sm:px-6">
            <Link href={href('/add')} className="link font-semibold">
              {t.claim}
            </Link>
            <CopyLinkButton url={shareUrl} label={t.copyLink} />
          </div>
        </div>
      </div>
    </div>
  );
}
