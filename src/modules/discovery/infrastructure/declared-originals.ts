import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { companies } from '@/modules/supplier';
import type { DeclaredOriginal } from './types';

// Oldest first: the admin works the queue in the order claims were declared.
export async function listDeclaredOriginals(db: Db): Promise<DeclaredOriginal[]> {
  const rows = await db
    .select({
      claimId: claims.id,
      createdAt: claims.createdAt,
      product: { id: products.id, brand: products.brand, name: products.name },
      company: { slug: companies.slug, name: companies.name },
    })
    .from(claims)
    .innerJoin(products, eq(claims.productId, products.id))
    .innerJoin(companies, eq(claims.companyId, companies.id))
    .where(and(eq(claims.kind, 'original'), eq(claims.status, 'declared')))
    .orderBy(asc(claims.createdAt));
  return rows;
}
