import Link from 'next/link';
import type { GarmentTile as Tile } from '@/modules/discovery';
import { GarmentImage } from './garment-image';

export function GarmentTile({ tile, href, tag, tagTone = 'muted' }: { tile: Tile; href: string; tag: string; tagTone?: 'accent' | 'muted' }) {
  const label = `${tile.brand} — ${tile.name}`;
  return (
    <Link href={href} data-testid="garment-tile" className="block">
      <GarmentImage src={tile.imageUrl} alt={label} className="aspect-[4/5]" />
      <div className="flex justify-between gap-3 px-3 py-2.5 text-[11px] font-medium">
        <span>{label}</span>
        <span className={`shrink-0 text-right ${tagTone === 'accent' ? 'text-accent' : 'text-muted'}`}>{tag}</span>
      </div>
    </Link>
  );
}
