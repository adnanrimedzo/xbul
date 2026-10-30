import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createProduct, type Product } from '@/modules/catalog';
import { findGarmentAction } from './actions';
import { visitorHash } from './_lib/visitor-hash';

const SECRET = 's'.repeat(32);
const lookups: string[] = [];
const recorded: { matched: boolean; visitorHash: string | null }[] = [];
let stored: Product | null = null;
let claimed = true; // whether any mill has a claim on the stored product
let logFails = false;
let requestHeaders = new Headers();
beforeEach(() => {
  lookups.length = 0;
  recorded.length = 0;
  stored = null;
  claimed = true;
  logFails = false;
  requestHeaders = new Headers();
  vi.useFakeTimers({ toFake: ['Date'] }); // the visitor hash changes at midnight UTC
  vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }));
vi.mock('@/server/container', () => ({
  getContainer: async () => ({
    products: {
      findByCanonicalUrl: async (url: string) => {
        lookups.push(url);
        return stored;
      },
    },
    claims: { existsForProduct: async (productId: string) => claimed && productId === stored?.id },
    searches: {
      record: async (input: { matched: boolean; visitorHash: string | null }) => {
        if (logFails) throw new Error('database down');
        recorded.push(input);
      },
    },
    config: { authSecret: SECRET },
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
  expect(recorded).toEqual([]); // a blank search isn't a search
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

it('counts a matched and an unmatched search, but not a blank one', async () => {
  await expect(findGarmentAction(null, form('   '))).resolves.toEqual({ notFound: true });
  expect(recorded).toEqual([]);

  expect(await findGarmentAction(null, form('https://example.com/nothing'))).toEqual({ notFound: true });
  expect(recorded).toEqual([{ matched: false, visitorHash: null }]);

  stored = tagged();
  await expect(findGarmentAction(null, form('https://guess.eu/en/blazer-W5RN12'))).rejects.toMatchObject({ digest: expect.stringContaining('/p/') });
  expect(recorded.at(-1)).toEqual({ matched: true, visitorHash: null });

  claimed = false; // previewed but never claimed: the buyer found nothing, so it counts as a miss
  await findGarmentAction(null, form('https://guess.eu/en/blazer-W5RN12'));
  expect(recorded.at(-1)).toEqual({ matched: false, visitorHash: null });
  expect(recorded).toHaveLength(3);
});

it('identifies the visitor by cf-connecting-ip, else the first x-forwarded-for hop, and stores only the hash', async () => {
  const hashOf = (ip: string) => visitorHash(ip, SECRET, new Date())!;
  const searchWith = async (headers: Record<string, string>) => {
    requestHeaders = new Headers(headers);
    await findGarmentAction(null, form('https://example.com/nothing'));
    return recorded.at(-1)!.visitorHash;
  };
  expect(await searchWith({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1' })).toBe(hashOf('203.0.113.9'));
  expect(await searchWith({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' })).toBe(hashOf('203.0.113.9'));
  expect(await searchWith({ 'cf-connecting-ip': '', 'x-forwarded-for': '' })).toBeNull();
  expect(JSON.stringify(recorded)).not.toContain('203.0.113.9');
});

it('still finds the product when the search log fails', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  logFails = true;
  stored = tagged();
  await expect(findGarmentAction(null, form('https://guess.eu/en/blazer-W5RN12'))).rejects.toMatchObject({ digest: expect.stringContaining(`/p/${stored.id}`) });
  expect(logged).toHaveBeenCalledTimes(1);

  logged.mockClear();
  stored = null; // a miss is answered too
  expect(await findGarmentAction(null, form('https://example.com/nothing'))).toEqual({ notFound: true });
  expect(logged).toHaveBeenCalledTimes(1);
});
