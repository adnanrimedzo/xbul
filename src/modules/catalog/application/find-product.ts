import { DomainError } from '@/shared/domain/errors';
import type { Product } from '../domain/product';
import { canonicalizeProductUrl } from '../domain/product-url';
import type { ProductRepository } from '../domain/repositories';

export async function findProductByUrl(deps: { products: ProductRepository }, rawUrl: string): Promise<Product | null> {
  let canonicalUrl: string;
  try {
    canonicalUrl = canonicalizeProductUrl(rawUrl);
  } catch (e) {
    if (e instanceof DomainError) return null;
    throw e;
  }
  return deps.products.findByCanonicalUrl(canonicalUrl);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ids come from the browser; Postgres throws 22P02 on malformed uuid text, so treat it as "not found".
export const getProduct = async (deps: { products: ProductRepository }, id: string): Promise<Product | null> =>
  UUID.test(id) ? deps.products.findById(id) : null;
