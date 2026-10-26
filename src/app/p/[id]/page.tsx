import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { InquiryForm } from '@/app/_components/inquiry-form';
import { Badge } from '@/app/_components/ui/badge';
import { Chip } from '@/app/_components/ui/chip';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { resolveAgent } from '@/app/_lib/resolve-agent';
import { getProductPageView } from '@/modules/discovery';
import type { ArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await getContainer();
  return (await getProductPageView(db, id)) ?? notFound();
});

const moq = (s: ArticleSpecs) => (s.moqMeters === null ? null : `MOQ ${s.moqMeters.toLocaleString('en-US')} m`);
const leadTime = (s: ArticleSpecs) => (s.leadTimeWeeks === null ? null : `${s.leadTimeWeeks} ${s.leadTimeWeeks === 1 ? 'week' : 'weeks'}`);

export async function generateMetadata({ params }: PageProps<'/p/[id]'>): Promise<Metadata> {
  const { product, originals, equivalents } = await loadView((await params).id);
  const { config } = await getContainer();
  const original = originals[0];
  const parts: string[] = [];
  if (original) parts.push(`Fabric by ${original.company.name}${original.article ? ` (article ${original.article.code})` : ''}`);
  if (equivalents.length > 0) parts.push(`${equivalents.length} ${equivalents.length === 1 ? 'mill' : 'mills'} can make an equivalent`);

  const title = `${product.brand} — ${product.name}`;
  const description = parts.join(' · ') || 'Find the mill behind this garment.';
  // The canonical url never carries ?via, so a shared link previews the same for everyone.
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/p/${product.id}`, images: product.imageUrl ? [product.imageUrl] : [] } };
}

export default async function ProductPage({ params, searchParams }: PageProps<'/p/[id]'>) {
  const [{ id }, { via }] = await Promise.all([params, searchParams]);
  const [{ product, originals, equivalents }, agent] = await Promise.all([loadView(id), resolveAgent(typeof via === 'string' ? via : undefined)]);
  const host = new URL(product.sourceUrl).hostname.replace(/^www\./, '');

  return (
    // Mockup .item: photo left, panel right; stacked below 760px.
    <div className="grid grid-cols-[1.25fr_1fr] max-[760px]:grid-cols-1">
      <div className="border-r border-ink max-[760px]:border-r-0 max-[760px]:border-b">
        <GarmentImage
          src={product.imageUrl}
          alt={`${product.brand} — ${product.name}`}
          credit={{ host, href: product.sourceUrl }}
          className="aspect-square border-b border-ink"
        />
      </div>
      <div className="self-start px-5 pt-[22px] pb-10">
        <Link href="/" className="mb-3.5 block text-[11px]">
          ← Back
        </Link>
        {agent && (
          <div className="mb-4 bg-[#f4f4f4] px-2.5 py-[9px] text-[10px]">
            Shared by agent <b className="text-accent">{agent.displayName}</b> — your request goes to the mill with this agent credited
          </div>
        )}
        <div className="text-[11px] text-muted">{product.brand}</div>
        <h1 className="mt-0.5 mb-1.5 text-[20px] font-semibold">{product.name}</h1>
        <div className="mb-[18px] text-[11px] text-muted">
          {product.composition && `${product.composition} · `}
          <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="border-b border-ink text-ink">
            View on {host} ↗
          </a>
        </div>

        {originals.map((c) => (
          <section key={c.claimId} data-testid="original-claim" className="border-t border-ink py-3.5">
            <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold">
              <h2>Original fabric</h2>
              <Badge tone={c.status === 'verified' ? 'accent' : 'outline'}>{c.status === 'verified' ? 'Verified' : 'Declared'}</Badge>
            </div>
            <div className="mb-2.5 text-[16px] font-semibold">{c.company.name}</div>
            {c.article && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[`Article ${c.article.code}`, c.article.specs.weightOz === null ? null : `${c.article.specs.weightOz} oz`, c.article.specs.composition, moq(c.article.specs), leadTime(c.article.specs)]
                  .filter((chip) => chip !== null)
                  .map((chip) => (
                    <Chip key={chip}>{chip}</Chip>
                  ))}
              </div>
            )}
            <InquiryForm
              companyId={c.company.id}
              companyName={c.company.name}
              productId={product.id}
              articleId={c.article?.id}
              kind="swatch"
              via={agent?.handle ?? null}
              label="Request swatch"
            />
          </section>
        ))}

        {equivalents.length > 0 && (
          <section className="border-t border-ink py-3.5">
            <h2 className="mb-2.5 flex justify-between text-[11px] font-semibold">
              Can make an equivalent <span>{equivalents.length}</span>
            </h2>
            {equivalents.map((c) => (
              <div key={c.claimId} data-testid="equivalent-claim" className="flex flex-wrap justify-between gap-x-3 border-b border-[#ddd] py-3 last:border-b-0">
                <div>
                  <div className="text-[13px] font-semibold">{c.company.name}</div>
                  {c.note && <div className="mt-[3px] text-[11px] text-muted normal-case">{c.note}</div>}
                  {c.article && <div className="mt-[5px] text-[10px]">{[moq(c.article.specs), leadTime(c.article.specs)].filter((fact) => fact !== null).join(' · ')}</div>}
                </div>
                <InquiryForm
                  companyId={c.company.id}
                  companyName={c.company.name}
                  productId={product.id}
                  articleId={c.article?.id}
                  kind="quote"
                  via={agent?.handle ?? null}
                  label="Request quote"
                />
              </div>
            ))}
          </section>
        )}

        <Link href="/add" className="flex justify-between border-t border-ink py-3 text-[12px] font-medium">
          Are you the mill? Claim this garment <span className="text-[16px] leading-none text-accent">+</span>
        </Link>
      </div>
    </div>
  );
}
