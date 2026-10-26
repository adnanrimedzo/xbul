'use server';

import { redirect } from 'next/navigation';
import { findProductByUrl } from '@/modules/catalog';
import { getContainer } from '@/server/container';

const MAX_URL = 2048;

// Public and read-only: it looks the pasted link up in our own catalog and never fetches it.
export async function findGarmentAction(_prev: { notFound: boolean } | null, form: FormData): Promise<{ notFound: boolean }> {
  const raw = form.get('url');
  const url = typeof raw === 'string' ? raw.trim() : '';
  if (!url || url.length > MAX_URL) return { notFound: true };
  const { products, claims } = await getContainer();
  const product = await findProductByUrl({ products }, url);
  // A garment only previewed on /add has a product row but no mill behind it yet, so it counts as not tagged.
  if (!product || !(await claims.existsForProduct(product.id))) return { notFound: true };
  redirect(`/p/${product.id}`); // outside any try/catch: redirect works by throwing
}
