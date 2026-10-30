import Image from 'next/image';
import { LinkButton } from '@/app/_components/ui/button';
import { ClaimTag } from '@/app/_components/ui/claim-tag';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { VerifiedExplanation } from '@/app/_components/ui/verified';
import { listRecentlyTagged, type GarmentTile as Tile } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { getViewer } from '@/server/viewer';
import { FindGarmentForm } from './find-garment-form';

// Counts joined by " · ", each only when there is one: "1 made it · 2 can make it", "2 can make it", or "Tagged" if neither.
const tileTag = ({ originals, equivalents }: Tile) =>
  [originals > 0 && `${originals} made it`, equivalents > 0 && `${equivalents} can make it`].filter(Boolean).join(' · ') || 'Tagged';

const STEPS = [
  ['Paste a link', 'Use a product page from any brand’s website.'],
  ['See who made it', 'Suppliers say whether they made it or can make an equivalent.'],
  ['Contact them directly', 'There are no agents, request forms or commissions. xbul.io takes no part in the deal.'],
];

export default async function Home() {
  const [{ db }, viewer] = await Promise.all([getContainer(), getViewer()]);
  const tiles = await listRecentlyTagged(db, 9);

  return (
    <>
      <section data-hero className="on-ink relative mx-3 -mt-px overflow-hidden rounded-b-frame bg-ink text-white sm:mx-4">
        <div aria-hidden="true">
          <div className="dot-field" />
          <div className="loupe max-[1279px]:hidden">
            <div className="loupe-lens">
              <div className="loupe-dots" />
            </div>
            <Image src="/logos/xbul-mark-white.svg" alt="" width={240} height={240} loading="eager" className="absolute inset-0 size-full" />
          </div>
        </div>
        <div className="relative mx-auto flex max-w-[760px] flex-col items-center px-5 pt-16 pb-24 text-center sm:pt-24 sm:pb-32">
          <h1 className="text-[clamp(2.75rem,8vw,5rem)] leading-none font-extrabold tracking-[-0.02em]">Who made this?</h1>
          <p className="mt-4 text-lg">Find the supplier behind any product.</p>
          <FindGarmentForm />
        </div>
      </section>

      <div className="page flex flex-col gap-16 pt-16">
        <section aria-labelledby="recent-title">
          <h2 id="recent-title" className="page-title mb-8">
            Recently tagged products
          </h2>
          {tiles.length > 0 ? (
            <GarmentGrid>
              {tiles.map((t) => (
                <GarmentTile key={t.productId} tile={t} href={`/p/${t.productId}`} tag={tileTag(t)} />
              ))}
            </GarmentGrid>
          ) : (
            <p className="text-muted">No products tagged yet.</p>
          )}
        </section>

        <section aria-labelledby="how-title" className="panel">
          <h2 id="how-title" className="page-title px-2 pt-2 pb-6 sm:px-6 sm:pt-4">
            How it works
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="card flex flex-col gap-10">
                <span className="font-mono text-sm font-medium text-accent">0{i + 1}</span>
                <div>
                  <h3 className="section-title">{title}</h3>
                  <p className="mt-2 text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="for-suppliers" className="grid scroll-mt-6 gap-3 lg:grid-cols-2">
          <div className="on-ink flex flex-col items-start justify-between gap-10 rounded-panel bg-ink p-8 text-white sm:p-10">
            <div>
              <h2 className="page-title">Make things? Show the work you’ve already done.</h2>
              <p className="mt-4 text-lg">Create a page, tag the products you’ve made or can make, and send evidence to earn a Verified badge for a product.</p>
            </div>
            <LinkButton variant="onDark" href={viewer?.company ? '/add' : '/sign-in'}>
              {viewer?.company ? 'Add products' : 'Create your page'}
            </LinkButton>
          </div>
          <div className="panel flex flex-col justify-between gap-10 p-8! sm:p-10!">
            <VerifiedExplanation />
            <div>
              <h2 className="section-title">What the tags mean</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <ClaimTag kind="original" />
                <ClaimTag kind="equivalent" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
