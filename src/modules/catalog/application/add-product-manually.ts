import { createProduct, type Product } from '../domain/product';
import { assertPublicHttpUrl, canonicalizeProductUrl, parseHttpUrl } from '../domain/product-url';
import type { ProductRepository } from '../domain/repositories';

export async function addProductManually(
  deps: { products: ProductRepository; allowPrivateHosts: boolean },
  input: { url: string; brand: string; name: string },
): Promise<Product> {
  const url = input.url.trim();
  const parsed = parseHttpUrl(url);
  const canonicalUrl = canonicalizeProductUrl(url);

  const existing = await deps.products.findByCanonicalUrl(canonicalUrl);
  if (existing) return existing;

  assertPublicHttpUrl(parsed, { allowPrivateHosts: deps.allowPrivateHosts });
  const product = createProduct({ canonicalUrl, sourceUrl: url, brand: input.brand, name: input.name, imageUrl: null, composition: null });
  await deps.products.save(product);
  return product;
}
