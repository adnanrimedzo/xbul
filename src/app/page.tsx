import { DenimPlaceholder } from '@/app/_components/ui/denim-placeholder';
import { GarmentGrid } from '@/app/_components/ui/garment-grid';
import { GarmentTile } from '@/app/_components/ui/garment-tile';
import { listRecentlyTagged, type GarmentTile as Tile } from '@/modules/discovery';
import { getContainer } from '@/server/container';
import { FindGarmentForm } from './find-garment-form';

// Counts joined by " · ", each only when there is one: "1 original · 2 equiv.", "2 equiv.", or "Tagged" if neither.
const tileTag = ({ originals, equivalents }: Tile) =>
  [originals > 0 && `${originals} original`, equivalents > 0 && `${equivalents} equiv.`].filter(Boolean).join(' · ') || 'Tagged';

export default async function Home() {
  const { db } = await getContainer();
  const tiles = await listRecentlyTagged(db, 12);

  return (
    <div>
      {/* Mockup .hero: 440px of denim, the jacket glyph up-left (136px wide, as the mockup renders it), the display text and find bar bottom-right. */}
      <DenimPlaceholder className="relative h-[440px] flex-col items-end justify-end border-b border-ink px-6 pb-7 [&>svg]:absolute [&>svg]:top-[16%] [&>svg]:left-[15%] [&>svg]:w-[136px] [&>svg]:opacity-35">
        <h1 className="relative text-right text-[clamp(40px,11vw,96px)] leading-[0.85] font-bold tracking-[-0.03em] text-paper">
          Who made{' '}
          <br />
          this?
        </h1>
        <FindGarmentForm />
      </DenimPlaceholder>

      <div className="flex justify-between gap-3 border-b border-ink px-5 py-3 text-[12px] font-medium">
        <span>Recently tagged</span>
        {/* Phase 1 has no brand directory, so this is a label, not a link. */}
        <span>Browse by brand ↗</span>
      </div>

      <div className="border-b border-ink px-5 py-[26px] text-center text-[12px]">
        <p>Welcome to xmanufacture.</p>
        <h2 className="mt-1 text-[15px] font-bold">Recently tagged products</h2>
      </div>

      {tiles.length > 0 ? (
        <GarmentGrid>
          {tiles.map((t) => (
            <GarmentTile key={t.productId} tile={t} href={`/p/${t.productId}`} tag={tileTag(t)} tagTone={t.originals > 0 ? 'accent' : 'muted'} />
          ))}
        </GarmentGrid>
      ) : (
        <p className="border-t border-ink px-5 py-6 text-[12px] text-muted normal-case">No products tagged yet.</p>
      )}
    </div>
  );
}
