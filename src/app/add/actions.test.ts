import { afterEach, expect, it, vi } from 'vitest';
import { createProductRepository, type ProductPageFetcher } from '@/modules/catalog';
import { createClaimRepository } from '@/modules/claims';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { addManualProductAction, previewGarmentsAction, publishGarmentsAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `refuse` makes requireMill throw, as it does when it redirects a visitor who is not a signed-in mill.
const viewer = vi.hoisted(() => ({ refuse: null as Error | null, company: { id: '', slug: '', kind: 'fabric_mill' } }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireMill: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return { company: viewer.company };
  },
}));

const GENERIC = 'Something went wrong. Please try again.';
const jacket = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Washed Denim Jacket', brand: { name: 'GUESS' }, material: '100% Cotton' })}</script>`;

afterEach(() => vi.restoreAllMocks());

async function setup(overrides: { findByCanonicalUrl?: (url: string) => Promise<null> } = {}) {
  viewer.refuse = null;
  viewer.company = { id: DEMO.companies.indigo, slug: DEMO.companySlugs.indigo, kind: 'fabric_mill' };
  const db = await createTestDb();
  await seedDemo(db);
  const products = createProductRepository(db);
  const claims = createClaimRepository(db);
  const { articles } = createSupplierRepositories(db);
  const fetched: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const fetcher: ProductPageFetcher = {
    async fetchHtml(url) {
      fetched.push(url);
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      if (url.includes('blocked')) throw new Error('403');
      if (url.includes('titled')) return '<title>Trucker Jacket - Armani</title>';
      return url.includes('plain') ? '<html><body>Hello</body></html>' : jacket;
    },
  };
  container.current = { products: { ...products, ...overrides }, fetcher, claims, articles, config: { allowPrivateHosts: false } };
  return { products, claims, articles, fetched, peak: () => peak };
}

const preview = (...lines: string[]) => previewGarmentsAction(lines.join('\n'));
const rowsOf = async (...lines: string[]) => {
  const result = await preview(...lines);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};

it('previews a fetched garment with the brand, name and composition the page declares', async () => {
  const { products } = await setup();
  const [row] = await rowsOf('https://brand.test/denim');
  const saved = await products.findByCanonicalUrl('https://brand.test/denim');
  expect(row).toEqual({ url: 'https://brand.test/denim', state: 'ready', productId: saved!.id, brand: 'GUESS', name: 'Washed Denim Jacket', imageUrl: null, composition: '100% Cotton' });
});

it('gives one row to spellings of the same link, and fetches it once', async () => {
  const { fetched } = await setup();
  const rows = await rowsOf('https://www.brand.test/denim?utm_source=ig', '', 'http://brand.test/denim/', '  https://brand.test/denim  ');
  expect(rows.map((r) => r.url)).toEqual(['https://www.brand.test/denim?utm_source=ig']);
  expect(fetched).toHaveLength(1);
});

it('counts the 50-link limit after dedupe', async () => {
  const { fetched } = await setup();
  expect(await rowsOf(...Array<string>(60).fill('https://brand.test/denim'))).toHaveLength(1);

  fetched.length = 0;
  const tooMany = Array.from({ length: 51 }, (_, i) => `https://brand.test/jacket-${i}`);
  expect(await preview(...tooMany)).toEqual({ ok: false, error: 'Add between 1 and 50 garments at a time.' });
  expect(fetched).toEqual([]);
});

it('refuses a paste too large to be 50 links, or not text at all, without fetching', async () => {
  const { fetched } = await setup();
  const batchSize = { ok: false, error: 'Add between 1 and 50 garments at a time.' };
  expect(await previewGarmentsAction(`https://brand.test/denim\n${' '.repeat(120_000)}`)).toEqual(batchSize);
  expect(await previewGarmentsAction(['https://brand.test/denim'] as unknown as string)).toEqual(batchSize);
  expect(await previewGarmentsAction(`https://brand.test/${'a'.repeat(119_000)}`)).toMatchObject({ ok: true, data: [{ state: 'invalid', error: 'Not a valid link.' }] });
  expect(fetched).toEqual([]);
});

it('says why each row is not ready, in the order pasted', async () => {
  await setup();
  const rows = await rowsOf('https://brand.test/blocked', 'not a url', 'https://brand.test/plain', 'http://localhost:4010/x', 'https://brand.test/denim');
  expect(rows).toMatchObject([
    { state: 'needs_details', reason: 'fetch_failed' },
    { state: 'invalid', error: 'Not a valid link.' },
    { state: 'needs_details', reason: 'not_a_product_page' },
    { state: 'invalid', error: "We can't fetch private addresses." },
    { state: 'ready', name: 'Washed Denim Jacket' },
  ]);
});

it('offers a title-only page for manual entry, pre-filled with its guess, and saves nothing', async () => {
  const { products } = await setup();
  expect(await rowsOf('https://armani.test/titled')).toEqual([
    { url: 'https://armani.test/titled', state: 'needs_details', reason: 'not_a_product_page', guess: { brand: 'ARMANI', name: 'Trucker Jacket' } },
  ]);
  expect(await products.findByCanonicalUrl('https://armani.test/titled')).toBeNull();
});

it('turns an unexpected failure into a generic row, logs it, and still previews the rest', async () => {
  await setup({ findByCanonicalUrl: (url) => (url.includes('boom') ? Promise.reject(new Error('db down')) : Promise.resolve(null)) });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const rows = await rowsOf('https://brand.test/boom', 'https://brand.test/denim');
  expect(rows).toMatchObject([{ state: 'invalid', error: GENERIC }, { state: 'ready' }]);
  expect(log).toHaveBeenCalledOnce();
});

it('imports at most 5 links at a time', async () => {
  const { peak } = await setup();
  expect(await rowsOf(...Array.from({ length: 12 }, (_, i) => `https://brand.test/jacket-${i}`))).toHaveLength(12);
  expect(peak()).toBe(5);
});

it('saves a link the mill described by hand, and says which field is too long', async () => {
  const { products } = await setup();
  const result = await addManualProductAction({ url: 'https://brand.test/blocked', brand: ' ZARA ', name: 'Black Denim Overshirt' });
  const saved = await products.findByCanonicalUrl('https://brand.test/blocked');
  expect(result).toEqual({
    ok: true,
    data: { url: 'https://brand.test/blocked', state: 'ready', productId: saved!.id, brand: 'ZARA', name: 'Black Denim Overshirt', imageUrl: null, composition: null },
  });

  expect(await addManualProductAction({ url: 'https://brand.test/x', brand: 'B'.repeat(61), name: 'Jacket' })).toEqual({ ok: false, error: 'Brand must be 1–60 characters.' });
  expect(await addManualProductAction({ url: 'http://localhost/x', brand: 'ZARA', name: 'Jacket' })).toEqual({ ok: false, error: "We can't fetch private addresses." });
});

it('publishes the ready rows under the mill from the session, then goes to its page', async () => {
  const { claims, articles } = await setup();
  const [coded, plain] = (await rowsOf('https://brand.test/denim', 'https://brand.test/denim-2')).flatMap((r) => (r.state === 'ready' ? [r.productId] : []));

  await expect(
    publishGarmentsAction([
      { productId: coded!, articleCode: ' 60777/2 ', kind: 'equivalent' },
      { productId: plain!, articleCode: '', kind: 'original' },
    ]),
  ).rejects.toMatchObject({ digest: expect.stringContaining(`/m/${DEMO.companySlugs.indigo}`) });

  const article = await articles.findByCode(DEMO.companies.indigo, '60777/2');
  expect(await claims.findByProductAndCompany(coded!, DEMO.companies.indigo)).toMatchObject({ kind: 'equivalent', scope: 'fabric', articleId: article!.id });
  expect(await claims.findByProductAndCompany(plain!, DEMO.companies.indigo)).toMatchObject({ kind: 'original', articleId: null });
});

it("files a garment maker's claims under the garment scope", async () => {
  const { claims } = await setup();
  viewer.company = { id: DEMO.companies.anka, slug: DEMO.companySlugs.anka, kind: 'garment_maker' };
  await expect(publishGarmentsAction([{ productId: DEMO.products.armani, articleCode: '', kind: 'original' }]))
    .rejects.toMatchObject({ digest: expect.stringContaining(`/m/${DEMO.companySlugs.anka}`) });
  expect(await claims.findByProductAndCompany(DEMO.products.armani, DEMO.companies.anka)).toMatchObject({ kind: 'original', scope: 'garment' });
});

it.each([
  ['no items', []],
  ['a malformed product id', [{ productId: 'nope', articleCode: '', kind: 'original' }]],
  ['an unknown kind', [{ productId: DEMO.products.guess, articleCode: '', kind: 'order' }]],
  ['an article code over 40 characters', [{ productId: DEMO.products.guess, articleCode: 'A'.repeat(41), kind: 'original' }]],
])('refuses %s without saving', async (_name, items) => {
  const { claims } = await setup();
  const before = await claims.findByProductAndCompany(DEMO.products.guess, DEMO.companies.indigo);
  expect(await publishGarmentsAction(items as never)).toEqual({ ok: false, error: GENERIC });
  expect(await claims.findByProductAndCompany(DEMO.products.guess, DEMO.companies.indigo)).toEqual(before);
});

it('lets nobody but a signed-in mill fetch, add or publish', async () => {
  const { products, claims, fetched } = await setup();
  const [productId] = (await rowsOf('https://brand.test/denim')).flatMap((r) => (r.state === 'ready' ? [r.productId] : []));
  fetched.length = 0;

  viewer.refuse = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/sign-in;307;' });
  await expect(preview('https://brand.test/fresh')).rejects.toBe(viewer.refuse);
  await expect(addManualProductAction({ url: 'https://brand.test/by-hand', brand: 'ZARA', name: 'Jacket' })).rejects.toBe(viewer.refuse);
  await expect(publishGarmentsAction([{ productId: productId!, articleCode: '60777/2', kind: 'original' }])).rejects.toBe(viewer.refuse);

  expect(fetched).toEqual([]);
  expect(await products.findByCanonicalUrl('https://brand.test/fresh')).toBeNull();
  expect(await products.findByCanonicalUrl('https://brand.test/by-hand')).toBeNull();
  expect(await claims.findByProductAndCompany(productId!, DEMO.companies.indigo)).toBeNull();
});
