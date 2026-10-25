import type { Product } from '../domain/product';

/** Returns the page body as text. Throws on any failure (network, non-2xx, non-html, too large, blocked host). */
export interface ProductPageFetcher {
  fetchHtml(url: string): Promise<string>;
}

export type ImportResult =
  | { status: 'ok'; product: Product }
  | { status: 'needs_details'; url: string; canonicalUrl: string; reason: 'fetch_failed' | 'not_a_product_page' };
