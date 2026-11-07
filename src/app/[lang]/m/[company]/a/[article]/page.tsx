import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CopyLinkButton } from '@/app/_components/copy-link-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { alternates } from '@/app/_lib/seo';
import { OG_LOCALE } from '@/i18n/locales';
import { pageMessages } from '@/i18n/server';
import { canSeeCompany, getArticlePageView } from '@/modules/discovery';
import type { ArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { EditSpecsForm } from './edit-specs-form';
import { ARTICLE } from './messages';

const SLUG = /^[a-z0-9-]{1,120}$/;
const DASH = '—';

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (company: string, article: string) => {
  if (!SLUG.test(company) || !SLUG.test(article)) notFound();
  const { db } = await getContainer();
  const view = (await getArticlePageView(db, company, article)) ?? notFound();
  if (!canSeeCompany(view.company, await getViewer())) notFound(); // not approved: only the owner and admins can open it
  return view;
});

const lead = (weeks: (n: number) => string, s: ArticleSpecs) => (s.leadTimeWeeks === null ? DASH : weeks(s.leadTimeWeeks));

export async function generateMetadata({ params }: PageProps<'/[lang]/m/[company]/a/[article]'>): Promise<Metadata> {
  const { company: companySlug, article: articleSlug } = await params;
  const [{ company, article, garments }, { config }, { t, lang, href }] = await Promise.all([loadView(companySlug, articleSlug), getContainer(), pageMessages(ARTICLE)]);
  const path = `/m/${company.slug}/a/${article.slug}`;
  const title = t.metaTitle(article.code, company.name);
  const description = [article.specs.weight, article.specs.composition, article.specs.finish].filter((s) => s !== null).join(' · ') || t.metaFallback(company.name);
  const image = garments.find((g) => g.imageUrl)?.imageUrl;
  return {
    title,
    description,
    alternates: alternates(lang, path),
    openGraph: { siteName: 'xbul.io', type: 'website', locale: OG_LOCALE[lang], title, description, url: `${config.baseUrl}${href(path)}`, images: image ? [image] : [] },
  };
}

export default async function ArticlePage({ params }: PageProps<'/[lang]/m/[company]/a/[article]'>) {
  const { company: companySlug, article: articleSlug } = await params;
  const [{ company, article, garments }, viewer, { config }, { t, href }] = await Promise.all([loadView(companySlug, articleSlug), getViewer(), getContainer(), pageMessages(ARTICLE)]);

  const shareUrl = `${config.baseUrl}${href(`/m/${company.slug}/a/${article.slug}`)}`;
  const { specs } = article;

  return (
    <div className="page flex flex-col gap-10">
      <div className="panel p-6! sm:p-10!">
        <nav aria-label="Breadcrumb">
          <Link href={href(`/m/${company.slug}`)} className="link">
            {company.name}
          </Link>{' '}
          / <span className="font-mono text-sm">{article.code}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1 className="page-title">{t.code(article.code)}</h1>
          <CopyLinkButton url={shareUrl} label={t.copyLink} />
        </div>
        <p className="mt-2 text-lg">
          {t.by(company.name, `${company.city}, ${company.country}`)}
        </p>
        <div className="mt-5">
          <h2 className="mb-1 font-semibold">{t.contact}</h2>
          <SupplierContact contact={company.contact} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            [t.weight, specs.weight ?? DASH],
            [t.composition, specs.composition ?? DASH],
            [t.finish, specs.finish ?? DASH],
            [t.moqLead, specs.moq === null && specs.leadTimeWeeks === null ? DASH : `${specs.moq ?? DASH} · ${lead(t.weeks, specs)}`],
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
          {t.linked(garments.length)}
        </h2>
        {garments.length > 0 && (
          <GarmentGrid>
            {garments.map((g) => (
              <GarmentTile key={g.productId} tile={g} href={href(`/p/${g.productId}`)} tag={g.kind && <ClaimTag kind={g.kind} />} />
            ))}
          </GarmentGrid>
        )}
      </section>
    </div>
  );
}
