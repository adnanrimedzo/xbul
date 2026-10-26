import { createProduct } from '../domain/product';
import { assertPublicHttpUrl, canonicalizeProductUrl, parseHttpUrl } from '../domain/product-url';
import type { ProductRepository } from '../domain/repositories';
import { parseProductPage } from '../infrastructure/parse-product-page';
import type { ImportResult, ProductPageFetcher } from './ports';

export async function importProduct(
  deps: { products: ProductRepository; fetcher: ProductPageFetcher; allowPrivateHosts: boolean },
  rawUrl: string,
): Promise<ImportResult> {
  const url = rawUrl.trim();
  const parsed = parseHttpUrl(url);
  const canonicalUrl = canonicalizeProductUrl(url);

  const existing = await deps.products.findByCanonicalUrl(canonicalUrl);
  if (existing) return { status: 'ok', product: existing };

  assertPublicHttpUrl(parsed, { allowPrivateHosts: deps.allowPrivateHosts });
  let html: string;
  try {
    html = await deps.fetcher.fetchHtml(url);
  } catch {
    return { status: 'needs_details', url, canonicalUrl, reason: 'fetch_failed' };
  }
  const page = parseProductPage(html, url);
  if (!page) return { status: 'needs_details', url, canonicalUrl, reason: 'not_a_product_page' };
  const { confidence, ...snapshot } = page;
  // Any page has a <title>, so a title alone doesn't make a product: the mill confirms it by hand before anything is saved.
  if (confidence === 'title') return { status: 'needs_details', url, canonicalUrl, reason: 'not_a_product_page', guess: { brand: snapshot.brand, name: snapshot.name } };

  const product = createProduct({ canonicalUrl, sourceUrl: url, ...snapshot });
  await deps.products.save(product);
  return { status: 'ok', product };
}
