import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CopyLinkButton } from '@/app/_components/copy-link-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { getArticlePageView } from '@/modules/discovery';
import type { ArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { EditSpecsForm } from './edit-specs-form';

const SLUG = /^[a-z0-9-]{1,120}$/;
const DASH = '—';

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (company: string, article: string) => {
  if (!SLUG.test(company) || !SLUG.test(article)) notFound();
  const { db } = await getContainer();
  return (await getArticlePageView(db, company, article)) ?? notFound();
});

const lead = (s: ArticleSpecs) => (s.leadTimeWeeks === null ? DASH : `${s.leadTimeWeeks} wks`);

export async function generateMetadata({ params }: PageProps<'/m/[company]/a/[article]'>): Promise<Metadata> {
  const { company: companySlug, article: articleSlug } = await params;
  const { company, article, garments } = await loadView(companySlug, articleSlug);
  const { config } = await getContainer();
  const title = `Code ${article.code} by ${company.name}`;
  const description = [article.specs.weight, article.specs.composition, article.specs.finish].filter((s) => s !== null).join(' · ') || `Supplier: ${company.name}`;
  const image = garments.find((g) => g.imageUrl)?.imageUrl;
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/m/${company.slug}/a/${article.slug}`, images: image ? [image] : [] } };
}

export default async function ArticlePage({ params }: PageProps<'/m/[company]/a/[article]'>) {
  const { company: companySlug, article: articleSlug } = await params;
  const [{ company, article, garments }, viewer, { config }] = await Promise.all([loadView(companySlug, articleSlug), getViewer(), getContainer()]);

  const shareUrl = `${config.baseUrl}/m/${company.slug}/a/${article.slug}`;
  const { specs } = article;

  return (
    <div className="page flex flex-col gap-10">
      <div className="panel p-6! sm:p-10!">
        <nav aria-label="Breadcrumb">
          <Link href={`/m/${company.slug}`} className="link">
            {company.name}
          </Link>{' '}
          / <span className="font-mono text-sm">{article.code}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="page-title">Code {article.code}</h1>
          <CopyLinkButton url={shareUrl} label="Copy link" />
        </div>
        <p className="mt-2 text-lg">
          By {company.name}, {company.city}, {company.country}
        </p>
        <div className="mt-5">
          <h2 className="mb-1 font-semibold">Contact directly</h2>
          <SupplierContact contact={company.contact} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Weight', specs.weight ?? DASH],
            ['Composition', specs.composition ?? DASH],
            ['Finish', specs.finish ?? DASH],
            ['MOQ and lead time', specs.moq === null && specs.leadTimeWeeks === null ? DASH : `${specs.moq ?? DASH} · ${lead(specs)}`],
          ].map(([name, value]) => (
            <div key={name} className="card p-4!">
              <dt className="text-sm text-muted">{name}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {viewer?.userId === company.ownerUserId && (
          <div className="mt-5">
            <EditSpecsForm articleId={article.id} specs={specs} />
          </div>
        )}
      </div>

      <section aria-labelledby="linked-title">
        <h2 id="linked-title" className="section-title mb-5">
          Linked to {garments.length} {garments.length === 1 ? 'product' : 'products'}
        </h2>
        {garments.length > 0 && (
          <GarmentGrid>
            {garments.map((g) => (
              <GarmentTile key={g.productId} tile={g} href={`/p/${g.productId}`} tag={g.kind && <ClaimTag kind={g.kind} />} />
            ))}
          </GarmentGrid>
        )}
      </section>
    </div>
  );
}
