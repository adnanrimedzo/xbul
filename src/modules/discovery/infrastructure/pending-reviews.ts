import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claimEvidence, claims, type ClaimScope } from '@/modules/claims';
import { companies } from '@/modules/supplier';
import type { PendingReview } from './types';

// Longest waiting first, by when each claim was sent in (its updatedAt: a republish of the same claim, such as a new note, moves it to the back).
export async function listPendingReviews(db: Db): Promise<PendingReview[]> {
  const rows = await db
    .select({
      claimId: claims.id,
      scope: claims.scope,
      product: { id: products.id, brand: products.brand, name: products.name },
      company: { slug: companies.slug, name: companies.name },
    })
    .from(claims)
    .innerJoin(products, eq(claims.productId, products.id))
    .innerJoin(companies, eq(claims.companyId, companies.id))
    .where(and(eq(claims.kind, 'original'), eq(claims.reviewStatus, 'pending')))
    .orderBy(asc(claims.updatedAt), asc(claims.id));
  if (rows.length === 0) return [];

  const files = await db
    .select({ id: claimEvidence.id, claimId: claimEvidence.claimId, fileName: claimEvidence.fileName, sizeBytes: claimEvidence.sizeBytes })
    .from(claimEvidence)
    .where(inArray(claimEvidence.claimId, rows.map((r) => r.claimId)))
    .orderBy(asc(claimEvidence.createdAt), asc(claimEvidence.id));
  return rows.map((r) => ({
    ...r,
    scope: r.scope as ClaimScope,
    evidence: files.filter((f) => f.claimId === r.claimId).map(({ id, fileName, sizeBytes }) => ({ id, fileName, sizeBytes })),
  }));
}
