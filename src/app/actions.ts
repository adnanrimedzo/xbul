'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { findProductByUrl, type SearchLog } from '@/modules/catalog';
import { getContainer } from '@/server/container';
import { visitorHash } from './_lib/visitor-hash';

const MAX_URL = 2048;

// Counting is best effort: a search that can't be counted is logged and still answered.
async function countSearch(searches: SearchLog, matched: boolean, secret: string) {
  try {
    const h = await headers();
    const ip = h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    await searches.record({ matched, visitorHash: visitorHash(ip, secret, new Date()) });
  } catch (error) {
    console.error('could not count a search', error);
  }
}

// Public and read-only: it looks the pasted link up in our own catalog and never fetches it.
export async function findGarmentAction(_prev: { notFound: boolean } | null, form: FormData): Promise<{ notFound: boolean }> {
  const raw = form.get('url');
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url || url.length > MAX_URL) return { notFound: true };
  const { products, claims, searches, config } = await getContainer();
  const product = await findProductByUrl({ products }, url);
  // A product only previewed on /add has a product row but no supplier behind it yet, so it counts as not tagged.
  const found = product && (await claims.existsForProduct(product.id)) ? product : null;
  await countSearch(searches, found !== null, config.authSecret);
  if (!found) return { notFound: true };
  redirect(`/p/${found.id}`); // outside any try/catch: redirect works by throwing
}
