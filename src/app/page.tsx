import type { CSSProperties } from 'react';
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
      <section className="flex flex-col items-center px-5 pt-20 text-center sm:pt-28">
        <h1 className="font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] font-medium tracking-[-0.06em]">Who made this?</h1>
        <p className="mt-5 max-w-[40ch] text-lg text-muted">Find the supplier behind any product.</p>
        <FindGarmentForm />
        <Mosaic />
      </section>

      <section aria-labelledby="recent-title" className="band px-5 py-16 sm:px-8 sm:py-20">
        <SectionHead eyebrow="Latest" id="recent-title" title="Recently tagged products" />
        {tiles.length > 0 ? (
          <GarmentGrid>
            {tiles.map((t) => (
              <GarmentTile key={t.productId} tile={t} href={`/p/${t.productId}`} tag={tileTag(t)} />
            ))}
          </GarmentGrid>
        ) : (
          <p className="text-center text-muted">No products tagged yet.</p>
        )}
      </section>

      <section aria-labelledby="how-title" className="band pt-16 sm:pt-20">
        <SectionHead eyebrow="Process" id="how-title" title="How it works" />
        <ol className="grid border-t border-line md:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-10 border-line px-5 py-8 not-first:border-t sm:px-8 md:not-first:border-t-0 md:not-first:border-l">
              <span className="font-mono text-sm text-muted">0{i + 1}</span>
              <div>
                <h3 className="section-title">{title}</h3>
                <p className="mt-2 text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="for-suppliers" className="band grid scroll-mt-6 lg:grid-cols-2">
        <div className="flex flex-col items-start justify-between gap-10 px-5 py-12 sm:px-8 sm:py-16">
          <div>
            <p className="eyebrow">For makers</p>
            <h2 className="page-title mt-3">Make things? Show the work you’ve already done.</h2>
            <p className="mt-4 text-lg text-muted">Create a page, tag the products you’ve made or can make, and send evidence to earn a Verified badge for a product.</p>
          </div>
          <LinkButton variant="cta" href={viewer?.company ? '/add' : '/sign-in'}>
            {viewer?.company ? 'Add products' : 'Create your page'}
          </LinkButton>
        </div>
        <div className="flex flex-col justify-between gap-10 border-t border-line bg-surface px-5 py-12 sm:px-8 sm:py-16 lg:border-t-0 lg:border-l">
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
    </>
  );
}

function SectionHead({ eyebrow, id, title }: { eyebrow: string; id: string; title: string }) {
  return (
    <div className="mb-10 flex flex-col items-center px-5 text-center sm:mb-12">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="page-title mt-3">
        {title}
      </h2>
    </div>
  );
}

// The hero's art: grey blocks thickening towards the bottom edge, like a product coming into focus, with one orange block.
// Fixed arithmetic rather than Math.random, so the server and the browser draw the same field.
const COLS = 24;
const ROWS = 5;
const CELLS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const on = (i * 37 + row * 11) % 9 < row + 1;
  return { on, strong: on && (i * 13) % 5 === 0, accent: i === COLS * 3 + 17, delay: (i * 7) % 12 };
});

function Mosaic() {
  return (
    <div aria-hidden="true" className="mosaic mt-20 w-full sm:mt-24" style={{ '--cols': COLS } as CSSProperties}>
      {CELLS.map((c, i) => (
        <span
          key={i}
          className={c.accent ? 'bg-accent' : c.strong ? 'bg-line' : c.on ? 'bg-line/50' : ''}
          style={{ '--d': c.on ? c.delay : 0, animationName: c.on ? undefined : 'none' } as CSSProperties}
        />
      ))}
    </div>
  );
}
