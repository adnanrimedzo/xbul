import { sql } from 'drizzle-orm';
import { products } from '@/modules/catalog';
import type { ClaimKind } from '@/modules/claims';
import type { GarmentTile } from './types';

// Counts cover every approved company's claims on the product, via correlated subqueries so each page needs one query.
// The subqueries alias `claims` as `k` so they work inside queries that already select from `claims`.
export const tileColumns = {
  productId: products.id,
  brand: products.brand,
  name: products.name,
  imageUrl: products.imageUrl,
  sourceUrl: products.sourceUrl,
  originals: sql<number>`(select count(*)::int from claims k join companies kc on kc.id = k.company_id where k.product_id = ${products.id} and k.kind = 'original' and kc.status = 'approved')`,
  equivalents: sql<number>`(select count(*)::int from claims k join companies kc on kc.id = k.company_id where k.product_id = ${products.id} and k.kind = 'equivalent' and kc.status = 'approved')`,
};

export const toTile = (r: Omit<GarmentTile, 'kind'>, kind: string | null): GarmentTile => ({ ...r, kind: kind as ClaimKind | null });
