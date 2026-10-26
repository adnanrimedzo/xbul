import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CopyLinkButton } from '@/app/_components/copy-link-button';
import { InquiryForm } from '@/app/_components/inquiry-form';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { resolveAgent } from '@/app/_lib/resolve-agent';
import { getArticlePageView } from '@/modules/discovery';
import type { ArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { EditSpecsForm } from './edit-specs-form';

const SLUG = /^[a-z0-9-]{1,120}$/;
const DASH = '—';
const metres = new Intl.NumberFormat('en');

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (company: string, article: string) => {
  if (!SLUG.test(company) || !SLUG.test(article)) notFound();
  const { db } = await getContainer();
  return (await getArticlePageView(db, company, article)) ?? notFound();
});

const weight = (s: ArticleSpecs) => (s.weightOz === null ? null : `${s.weightOz} oz`);
const moq = (s: ArticleSpecs) => (s.moqMeters === null ? DASH : `${metres.format(s.moqMeters)} m`);
const lead = (s: ArticleSpecs) => (s.leadTimeWeeks === null ? DASH : `${s.leadTimeWeeks} wks`);

export async function generateMetadata({ params }: PageProps<'/m/[company]/a/[article]'>): Promise<Metadata> {
  const { company: companySlug, article: articleSlug } = await params;
  const { company, article, garments } = await loadView(companySlug, articleSlug);
  const { config } = await getContainer();
  const title = `Article ${article.code} by ${company.name}`;
  const description = [weight(article.specs), article.specs.composition, article.specs.finish].filter((s) => s !== null).join(' · ') || `Fabric by ${company.name}`;
  const image = garments.find((g) => g.imageUrl)?.imageUrl;
  // The canonical url never carries ?via, so a shared link previews the same for everyone.
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/m/${company.slug}/a/${article.slug}`, images: image ? [image] : [] } };
}

export default async function ArticlePage({ params, searchParams }: PageProps<'/m/[company]/a/[article]'>) {
  const [{ company: companySlug, article: articleSlug }, { via }] = await Promise.all([params, searchParams]);
  const [{ company, article, garments }, viewer, agent, { config }] = await Promise.all([
    loadView(companySlug, articleSlug),
    getViewer(),
    resolveAgent(typeof via === 'string' ? via : undefined),
    getContainer(),
  ]);

  // An agent who copies this link credits themselves on every swatch request that comes through it.
  const handle = viewer?.profile?.role === 'agent' ? viewer.profile.handle : null;
  const shareUrl = `${config.baseUrl}/m/${company.slug}/a/${article.slug}${handle ? `?via=${handle}` : ''}`;
  const { specs } = article;
  const brands = [...new Set(garments.map((g) => g.brand))];

  return (
    <div>
      <nav aria-label="Breadcrumb" className="p-3 text-center text-[11px]">
        Mills / <Link href={`/m/${company.slug}`}>{company.name}</Link> / <span className="text-accent">{article.code}</span>
      </nav>

      {agent && (
        <div className="mx-5 mb-2.5 bg-[#f4f4f4] px-2.5 py-[9px] text-[10px]">
          Shared by agent <b className="text-accent">{agent.displayName}</b> — your request goes to the mill with this agent credited
        </div>
      )}

      {/* Mockup .arthead. The inquiry form's button and panel are flex items of this row, so an opened form wraps below it. */}
      <div className="flex flex-wrap items-end gap-x-2 px-5 pt-2.5 pb-[18px] [&_button]:min-h-10 [&_button]:w-auto">
        <div className="flex-1 max-[760px]:mb-3.5 max-[760px]:basis-full">
          <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">
            Article{' '}
            <br />
            {article.code}
          </h1>
          <div className="mt-2 text-[12px]">
            By <b className="text-accent">{company.name}</b> · {company.city}, {company.country}
          </div>
        </div>
        <CopyLinkButton url={shareUrl} label="Copy link for agents" />
        <InquiryForm companyId={company.id} companyName={company.name} articleId={article.id} kind="swatch" via={agent?.handle ?? null} label="Request swatch" />
      </div>

      <dl className="flex border-t border-ink max-[760px]:flex-wrap">
        {[
          ['Weight', weight(specs) ?? DASH],
          ['Composition', specs.composition ?? DASH],
          ['Finish', specs.finish ?? DASH],
          ['MOQ / lead', specs.moqMeters === null && specs.leadTimeWeeks === null ? DASH : `${moq(specs)} · ${lead(specs)}`],
        ].map(([name, value]) => (
          <div key={name} className="flex-1 border-r border-ink px-5 py-3 text-[11px] last:border-r-0 max-[760px]:basis-1/2 max-[760px]:border-b max-[760px]:nth-[2n]:border-r-0">
            <dt>{name}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {viewer?.userId === company.ownerUserId && (
        <div className="border-t border-ink px-5 py-3">
          <EditSpecsForm articleId={article.id} specs={specs} />
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-x-4 border-t border-ink px-5 py-3 text-[12px] font-semibold">
        <span>
          Linked to {garments.length} {garments.length === 1 ? 'garment' : 'garments'}
        </span>
        <span>{brands.join(' · ')}</span>
      </div>
      {garments.length > 0 && (
        <GarmentGrid>
          {garments.map((g) => (
            <GarmentTile
              key={g.productId}
              tile={g}
              href={`/p/${g.productId}`}
              tag={g.kind === 'original' ? 'Original' : 'Equivalent'}
              tagTone={g.kind === 'original' ? 'accent' : 'muted'}
            />
          ))}
        </GarmentGrid>
      )}
    </div>
  );
}
