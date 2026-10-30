import { count, countDistinct, sql } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { searchEvents } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { companies } from '@/modules/supplier';
import type { PlatformStats } from './types';

// Progress against the launch targets. Searchers are distinct visitor hashes, and a hash lasts one day, so a returning visitor counts once a day.
export async function getPlatformStats(db: Db): Promise<PlatformStats> {
  const [[suppliers], [products], [searches]] = await Promise.all([
    db.select({ n: count() }).from(companies),
    db.select({ n: countDistinct(claims.productId) }).from(claims),
    db
      .select({
        total: count(),
        matched: sql<number>`count(*) filter (where ${searchEvents.matched})`.mapWith(Number),
        searchers: countDistinct(searchEvents.visitorHash),
      })
      .from(searchEvents),
  ]);
  return {
    suppliers: suppliers?.n ?? 0,
    taggedProducts: products?.n ?? 0,
    searches: searches?.total ?? 0,
    matchedSearches: searches?.matched ?? 0,
    distinctSearchers: searches?.searchers ?? 0,
  };
}
