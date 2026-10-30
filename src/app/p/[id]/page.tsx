import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { CopyLinkButton } from '@/app/_components/copy-link-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Badge } from '@/app/_components/ui/badge';
import { Chip } from '@/app/_components/ui/chip';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { getProductPageView, type ClaimGroup, type ClaimView } from '@/modules/discovery';
import type { ArticleSpecs } from '@/modules/supplier';
import { getContainer } from '@/server/container';

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  const { db } = await getContainer();
  return (await getProductPageView(db, id)) ?? notFound();
});

const moq = (s: ArticleSpecs) => (s.moq === null ? null : `MOQ ${s.moq}`);
const leadTime = (s: ArticleSpecs) => (s.leadTimeWeeks === null ? null : `${s.leadTimeWeeks} ${s.leadTimeWeeks === 1 ? 'week' : 'weeks'}`);

const madeBy = (label: string, c: ClaimView | undefined) => c && `${label} by ${c.company.name}${c.article ? ` (article ${c.article.code})` : ''}`;

export async function generateMetadata({ params }: PageProps<'/p/[id]'>): Promise<Metadata> {
  const { product, fabric, garment } = await loadView((await params).id);
  const { config } = await getContainer();
  const equivalents = fabric.equivalents.length + garment.equivalents.length;
  const parts = [
    madeBy('Fabric', fabric.originals[0]),
    madeBy('Garment', garment.originals[0]),
    equivalents > 0 && `${equivalents} ${equivalents === 1 ? 'supplier' : 'suppliers'} can make an equivalent`,
  ].filter(Boolean);

  const title = `${product.brand} — ${product.name}`;
  const description = parts.join(' · ') || 'Find the mill behind this garment.';
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/p/${product.id}`, images: product.imageUrl ? [product.imageUrl] : [] } };
}

// One side of the product: who made the fabric, or who made the garment. Nothing to show means no section.
function SupplierSection({ title, testId, group: { originals, equivalents } }: { title: string; testId: string; group: ClaimGroup }) {
  if (originals.length === 0 && equivalents.length === 0) return null;
  return (
    <section data-testid={testId} aria-labelledby={`${testId}-title`} className="border-t border-ink pt-3.5">
      <h2 id={`${testId}-title`} className="text-[16px] font-bold">
        {title}
      </h2>
      {originals.map((c) => (
        <section key={c.claimId} data-testid="original-claim" className="py-3.5">
          <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold">
            <h3>Original</h3>
            <Badge tone={c.status === 'verified' ? 'accent' : 'outline'}>{c.status === 'verified' ? 'Verified' : 'Declared'}</Badge>
          </div>
          <div className="mb-2.5 text-[16px] font-semibold">{c.company.name}</div>
          {c.article && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[`Article ${c.article.code}`, c.article.specs.weight, c.article.specs.composition, moq(c.article.specs), leadTime(c.article.specs)]
                .filter((chip) => chip !== null)
                .map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
            </div>
          )}
          <SupplierContact contact={c.company.contact} />
        </section>
      ))}

      {equivalents.length > 0 && (
        <section className="py-3.5">
          <h3 className="mb-2.5 flex justify-between text-[11px] font-semibold">
            Can make an equivalent <span>{equivalents.length}</span>
          </h3>
          {equivalents.map((c) => (
            <div key={c.claimId} data-testid="equivalent-claim" className="border-b border-[#ddd] py-3 last:border-b-0">
              <div className="text-[13px] font-semibold">{c.company.name}</div>
              {c.note && <div className="mt-[3px] text-[11px] text-muted normal-case">{c.note}</div>}
              {c.article && <div className="mt-[5px] text-[10px]">{[moq(c.article.specs), leadTime(c.article.specs)].filter((fact) => fact !== null).join(' · ')}</div>}
              <div className="mt-2.5">
                <SupplierContact contact={c.company.contact} />
              </div>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

export default async function ProductPage({ params }: PageProps<'/p/[id]'>) {
  const [{ product, fabric, garment }, { config }] = await Promise.all([loadView((await params).id), getContainer()]);
  const host = new URL(product.sourceUrl).hostname.replace(/^www\./, '');
  const shareUrl = `${config.baseUrl}/p/${product.id}`;

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
        <div className="text-[11px] text-muted">{product.brand}</div>
        <h1 className="mt-0.5 mb-1.5 text-[20px] font-semibold">{product.name}</h1>
        <div className="mb-[18px] text-[11px] text-muted">
          {product.composition && `${product.composition} · `}
          <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="border-b border-ink text-ink">
            View on {host} ↗
          </a>
        </div>

        <SupplierSection title="Who made the fabric" testId="fabric-suppliers" group={fabric} />
        <SupplierSection title="Who made the garment" testId="garment-suppliers" group={garment} />

        <Link href="/add" className="flex justify-between border-t border-ink py-3 text-[12px] font-medium">
          Are you the mill? Claim this garment <span className="text-[16px] leading-none text-accent">+</span>
        </Link>
        {/* Mockup .acc "Share this page", with the article page's copy button. */}
        <div className="flex items-center justify-between gap-3 border-t border-ink py-3 text-[12px] font-medium">
          Share this page
          <CopyLinkButton url={shareUrl} label="Copy link" />
        </div>
      </div>
    </div>
  );
}
