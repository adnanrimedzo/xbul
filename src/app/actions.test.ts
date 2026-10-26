import { beforeEach, expect, it, vi } from 'vitest';
import { createProduct, type Product } from '@/modules/catalog';
import { findGarmentAction } from './actions';

const lookups: string[] = [];
let stored: Product | null = null;
let claimed = true; // whether any mill has a claim on the stored product
beforeEach(() => {
  lookups.length = 0;
  stored = null;
  claimed = true;
});
vi.mock('@/server/container', () => ({
  getContainer: async () => ({
    products: {
      findByCanonicalUrl: async (url: string) => {
        lookups.push(url);
        return stored;
      },
    },
    claims: { existsForProduct: async (productId: string) => claimed && productId === stored?.id },
  }),
}));

const form = (url: FormDataEntryValue | null) => {
  const f = new FormData();
  if (url !== null) f.set('url', url);
  return f;
};
const tagged = () =>
  createProduct({ canonicalUrl: 'https://guess.eu/en/blazer-W5RN12', sourceUrl: 'https://guess.eu/en/blazer-W5RN12', brand: 'GUESS', name: 'Blazer', imageUrl: null, composition: null });

it('answers notFound without a lookup for a missing, non-string, blank or over-long link', async () => {
  for (const f of [form(null), form(new File(['x'], 'x.txt')), form('   '), form(`https://guess.eu/${'a'.repeat(2048)}`)]) {
    expect(await findGarmentAction(null, f)).toEqual({ notFound: true });
  }
  expect(lookups).toEqual([]);
});

it('answers notFound for a link nobody has tagged', async () => {
  expect(await findGarmentAction(null, form('https://example.com/nothing'))).toEqual({ notFound: true });
});

it('looks the trimmed link up by its canonical url and redirects to the garment', async () => {
  stored = tagged();
  await expect(findGarmentAction(null, form('  https://www.guess.eu/en/blazer-W5RN12?utm_source=x  '))).rejects.toMatchObject({
    digest: expect.stringContaining(`/p/${stored.id}`),
  });
  expect(lookups.at(-1)).toBe('https://guess.eu/en/blazer-W5RN12');
});

it('answers notFound for a garment that was previewed but that no mill has claimed', async () => {
  stored = tagged();
  claimed = false;
  expect(await findGarmentAction(null, form('https://guess.eu/en/blazer-W5RN12'))).toEqual({ notFound: true });
});
