import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { CopyLinkButton } from '@/app/_components/copy-link-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Chip } from '@/app/_components/ui/chip';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentImage } from '@/app/_components/ui/garment-image';
import { VerifiedExplanation, VerifiedInline } from '@/app/_components/ui/verified';
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

const madeBy = (label: string, c: ClaimView | undefined) => c && `${label} by ${c.company.name}${c.article ? ` (code ${c.article.code})` : ''}`;

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
  const description = parts.join(' · ') || 'Find the supplier behind this product.';
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/p/${product.id}`, images: product.imageUrl ? [product.imageUrl] : [] } };
}

function ClaimCard({ claim, testId }: { claim: ClaimView; testId: string }) {
  const { company, article, kind, status, note } = claim;
  const specs = article && [kind === 'original' && `Code ${article.code}`, kind === 'original' && article.specs.weight, kind === 'original' && article.specs.composition, moq(article.specs), leadTime(article.specs)];
  return (
    <li data-testid={testId} className="card flex flex-col gap-3">
      <div>
        <h3 className="section-title">
          <Link href={`/m/${company.slug}`} className="hover:underline">
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
function SupplierSection({ title, testId, group: { originals, equivalents } }: { title: string; testId: string; group: ClaimGroup }) {
  if (originals.length === 0 && equivalents.length === 0) return null;
  return (
    <section data-testid={testId} aria-labelledby={`${testId}-title`} className="panel">
      <h2 id={`${testId}-title`} className="section-title px-2 pt-2 pb-4">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {originals.map((c) => (
          <ClaimCard key={c.claimId} claim={c} testId="original-claim" />
        ))}
        {equivalents.map((c) => (
          <ClaimCard key={c.claimId} claim={c} testId="equivalent-claim" />
        ))}
      </ul>
    </section>
  );
}

export default async function ProductPage({ params }: PageProps<'/p/[id]'>) {
  const [{ product, fabric, garment }, { config }] = await Promise.all([loadView((await params).id), getContainer()]);
  const host = new URL(product.sourceUrl).hostname.replace(/^www\./, '');
  const shareUrl = `${config.baseUrl}/p/${product.id}`;
  const anyVerified = [...fabric.originals, ...garment.originals].some((c) => c.status === 'verified');

  return (
    <div className="page">
      <Link href="/" className="link">
        Back to search
      </Link>
      <div className="mt-4 grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-6">
          <GarmentImage src={product.imageUrl} alt={`${product.brand} — ${product.name}`} credit={{ host, href: product.sourceUrl }} className="aspect-[4/3] rounded-panel lg:aspect-[4/5]" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="mb-2">
            <p className="font-mono text-sm text-muted">{product.brand}</p>
            <h1 className="page-title mt-1">{product.name}</h1>
            <p className="mt-2">
              {product.composition && <span className="text-muted">{product.composition} · </span>}
              <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="link font-mono text-sm">
                View on {host} ↗
              </a>
            </p>
          </div>

          <SupplierSection title="Who made the fabric" testId="fabric-suppliers" group={fabric} />
          <SupplierSection title="Who made the garment" testId="garment-suppliers" group={garment} />
          {anyVerified && <VerifiedExplanation className="px-2 py-4 sm:px-6" />}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-2 pt-5 sm:px-6">
            <Link href="/add" className="link font-semibold">
              Are you a supplier? Claim this product
            </Link>
            <CopyLinkButton url={shareUrl} label="Copy link" />
          </div>
        </div>
      </div>
    </div>
  );
}
