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

export const getProduct = (deps: { products: ProductRepository }, id: string): Promise<Product | null> => deps.products.findById(id);
