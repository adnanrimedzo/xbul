import { beforeAll, expect, it } from 'vitest';
import type { Db } from '@/shared/db/client';
import { createTestDb } from '@/shared/db/testing';
import { createClaimRepository } from '@/modules/claims';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import {
  getArticlePageView,
  getCompanyPageView,
  getProductPageView,
  listDeclaredOriginals,
  listRecentlyTagged,
} from '@/modules/discovery';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});

it('splits the garment page into who made the fabric and who made the garment', async () => {
  const v = await getProductPageView(db, DEMO.products.guess);
  expect(v?.fabric.originals.map((c) => [c.company.name, c.status, c.article?.code, c.article?.specs.moq])).toEqual([['Indigo Mill', 'verified', '60219/1', '1,000 m']]);
  expect(v?.fabric.equivalents.map((c) => c.company.name)).toEqual(['Denizli Indigo', 'Bursa Weave']);
  expect(v?.fabric.equivalents[0]).toMatchObject({ note: 'Same twill, 13 oz, rigid. Swatch in stock.', article: null });
  expect(v?.garment.originals.map((c) => [c.company.name, c.company.kind, c.status])).toEqual([['Anka Garments', 'garment_maker', 'verified']]);
  expect(v?.garment.equivalents).toEqual([]);
  // Contact details are public: every claim carries its supplier's, so a buyer needs no account to reach them.
  expect(v?.fabric.originals[0]?.company.contact).toEqual({ email: 'sales@indigo-mill.example', phone: null, website: 'https://indigo-mill.example/' });
  expect(v?.fabric.equivalents.map((c) => c.company.contact.email)).toEqual(['sales@denizli-indigo.example', 'sales@bursa-weave.example']);
  expect(v?.product).toMatchObject({ brand: 'GUESS', imageUrl: null, sourceUrl: 'https://guess.eu/en/cropped-denim-blazer-W5RN12' });
  expect(await getProductPageView(db, crypto.randomUUID())).toBeNull();
});

it('article page shows only that mill’s garments', async () => {
  const v = await getArticlePageView(db, 'indigo-mill', '60219-1');
  expect(v?.garments.map((g) => g.brand)).toEqual(['GUESS']);
  expect(v?.garments[0]?.sourceUrl).toBe('https://guess.eu/en/cropped-denim-blazer-W5RN12');
  expect(v?.article.specs.weight).toBe('12.5 oz');
  expect(v?.company.ownerUserId).toBe(DEMO.users.mill);
  expect(v?.company.contact.email).toBe('sales@indigo-mill.example');
  expect(await getArticlePageView(db, 'indigo-mill', 'nope')).toBeNull();
  expect(await getArticlePageView(db, 'nope', '60219-1')).toBeNull();
});

it('mill page lists articles with garment counts', async () => {
  const v = await getCompanyPageView(db, 'indigo-mill');
  expect(v?.articles).toEqual([{ slug: '60219-1', code: '60219/1', garmentCount: 1 }, { slug: '60409-1', code: '60409/1', garmentCount: 1 }]);
  expect(v?.company.contact).toEqual({ email: 'sales@indigo-mill.example', phone: null, website: 'https://indigo-mill.example/' });
  expect(v?.company.kind).toBe('fabric_mill');
  expect(v?.garments.map((g) => [g.brand, g.kind])).toEqual([['LIU-JO', 'original'], ['GUESS', 'original']]);
  expect(v?.garments[0]?.sourceUrl).toBe('https://liujo.com/it/printed-denim-jacket-UF4012');
  // Each tile carries this mill's claim, so the owner can withdraw it.
  expect(v?.garments[0]?.claimId).toBe((await createClaimRepository(db).findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))?.id);
  // Tile counts cover every mill's claims on the garment, not just this mill's.
  expect(v?.garments[1]).toMatchObject({ originals: 2, equivalents: 2 });
  // Claims without an article still show on the mill page.
  const denizli = await getCompanyPageView(db, 'denizli-indigo');
  expect(denizli?.articles).toEqual([]);
  expect(denizli?.garments.map((g) => [g.brand, g.kind])).toEqual([['EMPORIO ARMANI', 'equivalent'], ['GUESS', 'equivalent']]);
  expect(await getCompanyPageView(db, 'nope')).toBeNull();
});

it('recently tagged is ordered by latest claim with counts', async () => {
  const tiles = await listRecentlyTagged(db);
  expect(tiles.map((t) => [t.brand, t.originals, t.equivalents])).toEqual([['EMPORIO ARMANI', 0, 1], ['LIU-JO', 1, 0], ['GUESS', 2, 2]]);
  expect(tiles.every((t) => t.kind === null)).toBe(true);
  expect(tiles[0]?.sourceUrl).toBe('https://armani.com/en/trucker-jacket-6R1B79');
  expect(await listRecentlyTagged(db, 2)).toHaveLength(2);
});

it('lists declared (unverified) originals for admin', async () =>
  expect((await listDeclaredOriginals(db)).map((d) => d.product.brand)).toEqual(['LIU-JO']));

it('seedDemo is idempotent', async () => {
  await seedDemo(db);
  expect((await getCompanyPageView(db, 'indigo-mill'))?.garments).toHaveLength(2);
});
