import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { RowActionButton } from '@/app/_components/row-action-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Chip } from '@/app/_components/ui/chip';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { VerifiedExplanation, VerifiedInline } from '@/app/_components/ui/verified';
import { getCompanyPageView, type CompanyPageView } from '@/modules/discovery';
import type { CompanyKind } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { withdrawClaimAction } from './actions';
import { EditContactForm } from './edit-contact-form';

const SLUG = /^[a-z0-9-]{1,120}$/;
const KIND_LABEL: Record<CompanyKind, string> = { fabric_mill: 'Fabric mill', garment_maker: 'Garment maker' };

// What the owner can do next about an original: nothing once it is verified, wait while an admin reviews it, otherwise send documents
// (or, after a rejection, read why and send new ones).
function VerifyStep({ garment }: { garment: CompanyPageView['garments'][number] }) {
  if (garment.kind !== 'original' || garment.claimStatus !== 'declared') return null;
  if (garment.reviewStatus === 'pending') return <span className="inline-flex min-h-12 items-center font-semibold">Under review</span>;
  return (
    <Link href={`/verify/${garment.claimId}`} className="inline-flex min-h-12 items-center rounded-full border border-ink px-5 font-semibold transition-colors duration-150 hover:bg-ink hover:text-white">
      {garment.reviewStatus === 'rejected' ? 'Rejected: see why' : 'Get verified'}
    </Link>
  );
}

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (slug: string) => {
  if (!SLUG.test(slug)) notFound();
  const { db } = await getContainer();
  return (await getCompanyPageView(db, slug)) ?? notFound();
});

export async function generateMetadata({ params }: PageProps<'/m/[company]'>): Promise<Metadata> {
  const { company } = await loadView((await params).company);
  const { config } = await getContainer();
  const title = `${company.name} — ${KIND_LABEL[company.kind]}`;
  const description = `${company.city}, ${company.country}`;
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/m/${company.slug}` } };
}

export default async function MillPage({ params }: PageProps<'/m/[company]'>) {
  const [{ company, articles, garments }, viewer] = await Promise.all([loadView((await params).company), getViewer()]);
  const isOwner = viewer?.userId === company.ownerUserId;

  return (
    <div className="page flex flex-col gap-10">
      <div className="panel p-6! sm:p-10!">
        <h1 className="page-title">{company.name}</h1>
        <p className="mt-3 text-lg">
          {KIND_LABEL[company.kind]} in {company.city}, {company.country}
        </p>
        <div className="mt-5">
          <h2 className="mb-1 font-semibold">Contact directly</h2>
          <SupplierContact contact={company.contact} />
        </div>
        {isOwner && (
          <div className="mt-5">
            <EditContactForm contact={company.contact} />
          </div>
        )}
      </div>

      {articles.length > 0 && (
        <section aria-labelledby="codes-title">
          <h2 id="codes-title" className="section-title mb-3">
            Product codes
          </h2>
          <div className="flex flex-wrap gap-2">
            {articles.map((a) => (
              <Link key={a.slug} href={`/m/${company.slug}/a/${a.slug}`} className="rounded-full hover:underline">
                <Chip>
                  {a.code} · {a.garmentCount} {a.garmentCount === 1 ? 'product' : 'products'}
                </Chip>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="products-title">
        <h2 id="products-title" className="section-title mb-5">
          Products
        </h2>
        {garments.length > 0 ? (
          <GarmentGrid>
            {garments.map((g) => (
              <div key={g.productId} data-testid="mill-garment">
                <GarmentTile
                  tile={g}
                  href={`/p/${g.productId}`}
                  tag={
                    <>
                      {g.kind && <ClaimTag kind={g.kind} />}
                      {g.claimStatus === 'verified' && <VerifiedInline />}
                    </>
                  }
                />
                {/* Below the tile link, not inside it: the owner can take a product back off its page. */}
                {isOwner && (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <RowActionButton action={withdrawClaimAction.bind(null, g.claimId)} label="Remove" confirmLabel="Confirm remove" />
                    <VerifyStep garment={g} />
                  </div>
                )}
              </div>
            ))}
          </GarmentGrid>
        ) : (
          <p className="text-muted">No products linked yet.</p>
        )}
      </section>

      {garments.some((g) => g.claimStatus === 'verified') && <VerifiedExplanation className="border-t border-line pt-6" />}
    </div>
  );
}
