import { count, countDistinct, eq, sql } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { searchEvents } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { photoChecks, supplierPhotos } from '@/modules/photos';
import { companies } from '@/modules/supplier';
import type { PlatformStats } from './types';

// Progress against the launch targets. Searchers are distinct visitor hashes, and a hash lasts one day, so a returning visitor counts once a day.
export async function getPlatformStats(db: Db): Promise<PlatformStats> {
  const [[suppliers], [pending], [products], [searches], [photoSearches], [photos]] = await Promise.all([
    db.select({ n: count() }).from(companies).where(eq(companies.status, 'approved')),
    db.select({ n: count() }).from(companies).where(eq(companies.status, 'submitted')),
    db.select({ n: countDistinct(claims.productId) }).from(claims).innerJoin(companies, eq(claims.companyId, companies.id)).where(eq(companies.status, 'approved')),
    db
      .select({
        total: count(),
        matched: sql<number>`count(*) filter (where ${searchEvents.matched})`.mapWith(Number),
        searchers: countDistinct(searchEvents.visitorHash),
      })
      .from(searchEvents),
    // Photo checks are kept as rows (their photos go after 7 days), so this counts every buyer photo search ever made.
    db
      .select({ total: count(), accepted: sql<number>`count(*) filter (where ${photoChecks.decision} <> 'rejected')`.mapWith(Number) })
      .from(photoChecks)
      .where(eq(photoChecks.source, 'buyer')),
    db.select({ n: count() }).from(supplierPhotos).where(eq(supplierPhotos.status, 'published')),
  ]);
  return {
    suppliers: suppliers?.n ?? 0,
    pendingSuppliers: pending?.n ?? 0,
    taggedProducts: products?.n ?? 0,
    searches: searches?.total ?? 0,
    matchedSearches: searches?.matched ?? 0,
    distinctSearchers: searches?.searchers ?? 0,
    photoSearches: photoSearches?.total ?? 0,
    acceptedPhotoSearches: photoSearches?.accepted ?? 0,
    publishedPhotos: photos?.n ?? 0,
  };
}
