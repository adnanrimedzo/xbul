import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GarmentTile as Tile } from '@/modules/discovery';
import { GarmentImage } from './garment-image';

export function GarmentTile({ tile, href, tag }: { tile: Tile; href: string; tag: ReactNode }) {
  const label = `${tile.brand} — ${tile.name}`;
  const host = new URL(tile.sourceUrl).hostname.replace(/^www\./, '');
  return (
    <Link href={href} data-testid="garment-tile" className="group block rounded-card">
      <GarmentImage src={tile.imageUrl} alt={label} credit={{ host }} className="aspect-[4/5] rounded-card border border-line" />
      <p className="mt-3 font-mono text-sm text-muted">{tile.brand}</p>
      <p className="mt-0.5 font-display leading-snug font-medium tracking-[-0.01em] group-hover:underline">{tile.name}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">{tag}</div>
    </Link>
  );
}
