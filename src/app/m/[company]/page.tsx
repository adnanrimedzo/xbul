import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Chip } from '@/app/_components/ui/chip';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { getCompanyPageView } from '@/modules/discovery';
import { getContainer } from '@/server/container';

const SLUG = /^[a-z0-9-]{1,120}$/;

// Shared by generateMetadata and the page, so the view is read once per request.
const loadView = cache(async (slug: string) => {
  if (!SLUG.test(slug)) notFound();
  const { db } = await getContainer();
  return (await getCompanyPageView(db, slug)) ?? notFound();
});

export async function generateMetadata({ params }: PageProps<'/m/[company]'>): Promise<Metadata> {
  const { company } = await loadView((await params).company);
  const { config } = await getContainer();
  const title = `${company.name} — fabric mill`;
  const description = `${company.city}, ${company.country}`;
  return { title, description, openGraph: { title, description, url: `${config.baseUrl}/m/${company.slug}` } };
}

export default async function MillPage({ params }: PageProps<'/m/[company]'>) {
  const { company, articles, garments } = await loadView((await params).company);

  return (
    <div>
      <div className="px-5 pt-7 pb-[18px]">
        <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">{company.name}</h1>
        <div className="mt-2 text-[12px]">
          {company.city}, {company.country}
        </div>
      </div>

      {articles.length > 0 && (
        <section aria-label="Articles" className="flex flex-wrap items-center gap-2 border-t border-ink px-5 py-3 text-[12px]">
          <h2 className="mr-2 font-semibold">Articles</h2>
          {articles.map((a) => (
            <Link key={a.slug} href={`/m/${company.slug}/a/${a.slug}`}>
              <Chip>
                {a.code} · {a.garmentCount} {a.garmentCount === 1 ? 'garment' : 'garments'}
              </Chip>
            </Link>
          ))}
        </section>
      )}

      <div className="flex justify-between border-t border-ink px-5 py-3 text-[12px] font-semibold">
        <h2>Garments</h2>
        <span>{garments.length}</span>
      </div>
      {garments.length > 0 ? (
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
      ) : (
        <p className="border-t border-ink px-5 py-6 text-[12px] text-muted normal-case">No garments linked yet.</p>
      )}
    </div>
  );
}
