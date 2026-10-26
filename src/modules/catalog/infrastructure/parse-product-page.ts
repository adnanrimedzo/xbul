import { parse } from 'node-html-parser';
import type { ProductSnapshot } from '../domain/product';
import { brandFromHost } from '../domain/product-url';

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const cut = (s: string, max: number) => s.slice(0, max).trim(); // keeps createProduct's 160/60 limits from failing on SEO titles
const normalize = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

function findProduct(node: unknown): Json | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object' || node === null) return null;
  const obj = node as Json;
  const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
  if (types.some((t) => typeof t === 'string' && t.includes('Product'))) return obj;
  return findProduct(obj['@graph']);
}

function imageOf(v: unknown): string | null {
  if (Array.isArray(v)) return imageOf(v[0]);
  if (typeof v === 'object' && v !== null) return str((v as Json).url);
  return str(v);
}

function stripBrandSuffix(name: string, brands: string[]): string {
  const m = /^(.*\S)\s+[|-]\s+(.+)$/.exec(name);
  return m && brands.some((b) => normalize(b) === normalize(m[2]!)) ? m[1]! : name;
}

// `confidence` is where the name came from: a JSON-LD Product or og:title ('structured'), or only the <title> ('title'),
// which every page has, product or not.
export type ParsedProductPage = ProductSnapshot & { confidence: 'structured' | 'title' };

export function parseProductPage(html: string, pageUrl: string): ParsedProductPage | null {
  const root = parse(html);
  const meta = (property: string) => str(root.querySelector(`meta[property="${property}"]`)?.getAttribute('content'));

  let product: Json | null = null;
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      product = findProduct(JSON.parse(script.rawText));
    } catch {
      continue; // malformed JSON-LD is common; fall through to Open Graph
    }
    if (product) break;
  }

  const hostBrand = brandFromHost(new URL(pageUrl).hostname);
  const ldBrand = typeof product?.brand === 'object' && product.brand !== null ? (product.brand as Json).name : product?.brand;
  const brand = str(ldBrand) ?? meta('product:brand') ?? meta('og:site_name') ?? hostBrand;
  const structuredName = str(product?.name) ?? meta('og:title');
  const rawName = structuredName ?? str(root.querySelector('title')?.text);
  if (!rawName) return null;

  const rawImage = imageOf(product?.image) ?? meta('og:image');
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, pageUrl).href;
    } catch {
      imageUrl = null;
    }
  }

  return {
    brand: cut(brand, 60),
    name: cut(stripBrandSuffix(rawName, [brand, hostBrand]), 160),
    imageUrl,
    composition: str(product?.material),
    confidence: structuredName ? 'structured' : 'title',
  };
}
