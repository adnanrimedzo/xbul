import { desc, eq, inArray, max, sql } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { tileColumns, toTile } from './garment-tiles';
import type { GarmentTile } from './types';

// `brandNames` narrows it to one brand, matched case-insensitively against any of its spellings ("H&M", "h&m").
export async function listRecentlyTagged(db: Db, limit = 12, brandNames?: string[]): Promise<GarmentTile[]> {
  const query = db.select(tileColumns).from(products).innerJoin(claims, eq(claims.productId, products.id)).$dynamic();
  if (brandNames) query.where(inArray(sql`lower(${products.brand})`, brandNames.map((b) => b.toLowerCase())));
  const rows = await query.groupBy(products.id).orderBy(desc(max(claims.createdAt))).limit(limit);
  return rows.map((r) => toTile(r, null));
}
