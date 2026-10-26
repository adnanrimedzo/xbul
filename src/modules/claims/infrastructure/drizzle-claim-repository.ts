import { and, eq, type SQL } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { Claim, ClaimKind, ClaimStatus } from '../domain/claim';
import type { ClaimRepository } from '../domain/repositories';
import { claims } from './schema';

const toClaim = (r: typeof claims.$inferSelect): Claim =>
  Object.freeze({
    id: r.id,
    productId: r.productId,
    companyId: r.companyId,
    articleId: r.articleId,
    kind: r.kind as ClaimKind,
    status: r.status as ClaimStatus,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });

export function createClaimRepository(db: Db): ClaimRepository {
  const claimBy = async (where: SQL | undefined) => {
    const [row] = await db.select().from(claims).where(where).limit(1);
    return row ? toClaim(row) : null;
  };

  return {
    async save(c) {
      await db.insert(claims).values(c).onConflictDoUpdate({ target: claims.id, set: c });
    },
    async delete(id) {
      await db.delete(claims).where(eq(claims.id, id));
    },
    findById: (id) => claimBy(eq(claims.id, id)),
    findByProductAndCompany: (productId, companyId) => claimBy(and(eq(claims.productId, productId), eq(claims.companyId, companyId))),
    findVerifiedOriginal: (productId) =>
      claimBy(and(eq(claims.productId, productId), eq(claims.kind, 'original'), eq(claims.status, 'verified'))),
  };
}
