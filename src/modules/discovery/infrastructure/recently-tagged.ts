import { desc, eq, max } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { tileColumns, toTile } from './garment-tiles';
import type { GarmentTile } from './types';

export async function listRecentlyTagged(db: Db, limit = 12): Promise<GarmentTile[]> {
  const rows = await db
    .select(tileColumns)
    .from(products)
    .innerJoin(claims, eq(claims.productId, products.id))
    .groupBy(products.id)
    .orderBy(desc(max(claims.createdAt)))
    .limit(limit);
  return rows.map((r) => toTile(r, null));
}
