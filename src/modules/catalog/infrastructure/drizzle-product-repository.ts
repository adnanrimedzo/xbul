import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { ProductTypeId } from '@/shared/domain/taxonomy';
import type { Product } from '../domain/product';
import type { ProductRepository } from '../domain/repositories';
import { products } from './schema';

const toProduct = (r: typeof products.$inferSelect): Product =>
  Object.freeze({
    id: r.id,
    canonicalUrl: r.canonicalUrl,
    sourceUrl: r.sourceUrl,
    brand: r.brand,
    name: r.name,
    imageUrl: r.imageUrl,
    composition: r.composition,
    type: r.type as ProductTypeId | null,
    createdAt: r.createdAt,
  });

export function createProductRepository(db: Db): ProductRepository {
  const productBy = async (where: SQL) => {
    const [row] = await db.select().from(products).where(where).limit(1);
    return row ? toProduct(row) : null;
  };

  return {
    async save(p) {
      await db.insert(products).values(p).onConflictDoUpdate({ target: products.id, set: p });
    },
    findById: (id) => productBy(eq(products.id, id)),
    findByCanonicalUrl: (url) => productBy(eq(products.canonicalUrl, url)),
    async setTypeIfNull(id, type) {
      await db.update(products).set({ type }).where(and(eq(products.id, id), isNull(products.type)));
    },
  };
}
