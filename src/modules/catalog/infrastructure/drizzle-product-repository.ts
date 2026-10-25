import { eq, type SQL } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
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
  };
}
