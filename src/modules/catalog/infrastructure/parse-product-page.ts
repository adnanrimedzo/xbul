import { parse } from 'node-html-parser';
import type { ProductSnapshot } from '../domain/product';
import { brandFromHost } from '../domain/product-url';

type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
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

export function parseProductPage(html: string, pageUrl: string): ProductSnapshot | null {
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
  const rawName = str(product?.name) ?? meta('og:title') ?? str(root.querySelector('title')?.text);
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

  return { brand, name: stripBrandSuffix(rawName, [brand, hostBrand]), imageUrl, composition: str(product?.material) };
}
