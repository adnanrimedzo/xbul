import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { RowActionButton } from '@/app/_components/row-action-button';
import { SupplierContact } from '@/app/_components/supplier-contact';
import { Chip } from '@/app/_components/ui/chip';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
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
  if (garment.reviewStatus === 'pending') return <span className="py-[7px] text-[11px] font-semibold">Under review</span>;
  return (
    <Link href={`/verify/${garment.claimId}`} className="border border-ink px-2.5 py-[7px] text-[11px] font-semibold">
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
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">{company.name}</h1>
        <div className="mt-2 text-[12px] font-semibold">{KIND_LABEL[company.kind]}</div>
        <div className="mt-0.5 text-[12px]">
          {company.city}, {company.country}
        </div>
        <div className="mt-2.5">
          <SupplierContact contact={company.contact} />
        </div>
        {isOwner && (
          <div className="mt-3">
            <EditContactForm contact={company.contact} />
          </div>
        )}
      </div>

      {articles.length > 0 && (
        <section aria-label="Product codes" className="flex flex-wrap items-center gap-2 border-t border-ink px-5 py-3 text-[12px]">
          <h2 className="mr-2 font-semibold">Product codes</h2>
          {articles.map((a) => (
            <Link key={a.slug} href={`/m/${company.slug}/a/${a.slug}`}>
              <Chip>
                {a.code} · {a.garmentCount} {a.garmentCount === 1 ? 'product' : 'products'}
              </Chip>
            </Link>
          ))}
        </section>
      )}

      <div className="flex justify-between border-t border-ink px-5 py-3 text-[12px] font-semibold">
        <h2>Products</h2>
        <span>{garments.length}</span>
      </div>
      {garments.length > 0 ? (
        <GarmentGrid>
          {garments.map((g) => (
            <div key={g.productId} data-testid="mill-garment">
              <GarmentTile tile={g} href={`/p/${g.productId}`} tag={g.kind === 'original' ? 'Original' : 'Equivalent'} tagTone={g.kind === 'original' ? 'accent' : 'muted'} />
              {/* Below the tile link, not inside it: the owner can take a product back off its page. */}
              {isOwner && (
                <div className="flex flex-wrap items-start gap-2 px-3 pb-2.5">
                  <RowActionButton action={withdrawClaimAction.bind(null, g.claimId)} label="Remove" confirmLabel="Confirm remove" />
                  <VerifyStep garment={g} />
                </div>
              )}
            </div>
          ))}
        </GarmentGrid>
      ) : (
        <p className="border-t border-ink px-5 py-6 text-[12px] text-muted normal-case">No products linked yet.</p>
      )}
    </div>
  );
}
