import { eq } from 'drizzle-orm';
import { beforeAll, expect, it } from 'vitest';
import type { Db } from '@/shared/db/client';
import { createTestDb } from '@/shared/db/testing';
import { products } from '@/modules/catalog';
import { createInquiry, createInquiryRepository, markAnswered } from '@/modules/inquiry';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import {
  getArticlePageView,
  getCompanyPageView,
  getProductPageView,
  listCompanyInquiries,
  listDeclaredOriginals,
  listRecentlyTagged,
} from '@/modules/discovery';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});

it('builds the garment page with ranked originals and equivalents', async () => {
  const v = await getProductPageView(db, DEMO.products.guess);
  expect(v?.originals.map((c) => [c.company.name, c.status, c.article?.code, c.article?.specs.moqMeters])).toEqual([['Indigo Mill', 'verified', '60219/1', 1000]]);
  expect(v?.equivalents.map((c) => c.company.name)).toEqual(['Denizli Indigo', 'Bursa Weave']);
  expect(v?.equivalents[0]).toMatchObject({ note: 'Same twill, 13 oz, rigid. Swatch in stock.', article: null });
  expect(v?.product).toMatchObject({ brand: 'GUESS', imageUrl: null, sourceUrl: 'https://guess.eu/en/cropped-denim-blazer-W5RN12' });
  expect(await getProductPageView(db, crypto.randomUUID())).toBeNull();
});

it('article page shows only that mill’s garments', async () => {
  const v = await getArticlePageView(db, 'indigo-mill', '60219-1');
  expect(v?.garments.map((g) => g.brand)).toEqual(['GUESS']);
  expect(v?.article.specs.weightOz).toBe(12.5);
  expect(v?.company.ownerUserId).toBe(DEMO.users.mill);
  expect(await getArticlePageView(db, 'indigo-mill', 'nope')).toBeNull();
  expect(await getArticlePageView(db, 'nope', '60219-1')).toBeNull();
});

it('mill page lists articles with garment counts', async () => {
  const v = await getCompanyPageView(db, 'indigo-mill');
  expect(v?.articles).toEqual([{ slug: '60219-1', code: '60219/1', garmentCount: 1 }, { slug: '60409-1', code: '60409/1', garmentCount: 1 }]);
  expect(v?.garments.map((g) => [g.brand, g.kind])).toEqual([['LIU-JO', 'original'], ['GUESS', 'original']]);
  // Tile counts cover every mill's claims on the garment, not just this mill's.
  expect(v?.garments[1]).toMatchObject({ originals: 1, equivalents: 2 });
  // Claims without an article still show on the mill page.
  const denizli = await getCompanyPageView(db, 'denizli-indigo');
  expect(denizli?.articles).toEqual([]);
  expect(denizli?.garments.map((g) => [g.brand, g.kind])).toEqual([['EMPORIO ARMANI', 'equivalent'], ['GUESS', 'equivalent']]);
  expect(await getCompanyPageView(db, 'nope')).toBeNull();
});

it('recently tagged is ordered by latest claim with counts', async () => {
  const tiles = await listRecentlyTagged(db);
  expect(tiles.map((t) => [t.brand, t.originals, t.equivalents])).toEqual([['EMPORIO ARMANI', 0, 1], ['LIU-JO', 1, 0], ['GUESS', 1, 2]]);
  expect(tiles.every((t) => t.kind === null)).toBe(true);
  expect(await listRecentlyTagged(db, 2)).toHaveLength(2);
});

it('lists declared (unverified) originals for admin', async () =>
  expect((await listDeclaredOriginals(db)).map((d) => d.product.brand)).toEqual(['LIU-JO']));

it('lists a mill’s inquiries with a readable target', async () => {
  const rows = await listCompanyInquiries(db, DEMO.companies.indigo);
  expect(rows[0]).toMatchObject({ buyerCompany: 'Seed Buyer Co', viaAgentHandle: 'lauramartin-demo', target: { href: `/p/${DEMO.products.guess}`, label: 'GUESS — Cropped Denim Blazer' } });
  expect(await listCompanyInquiries(db, DEMO.companies.bursa)).toEqual([]);
});

it('seedDemo is idempotent', async () => {
  await seedDemo(db);
  expect(await listCompanyInquiries(db, DEMO.companies.indigo)).toHaveLength(1);
});

it('orders new inquiries first, then newest, and survives a deleted target', async () => {
  const own = await createTestDb();
  await seedDemo(own);
  const repo = createInquiryRepository(own);
  const base = { companyId: DEMO.companies.indigo, productId: null, articleId: DEMO.articles.indigo60219, kind: 'quote' as const, buyerEmail: 'b@buyer.test', viaAgentHandle: null };
  const answered = markAnswered(createInquiry({ ...base, buyerName: 'Answered' }, new Date('2026-02-01T00:00:00Z')));
  await repo.save(answered);
  await repo.save(createInquiry({ ...base, buyerName: 'Older new' }, new Date('2026-01-01T00:00:00Z')));

  const rows = await listCompanyInquiries(own, DEMO.companies.indigo);
  expect(rows.map((r) => [r.buyerName, r.status])).toEqual([['Seed Buyer', 'new'], ['Older new', 'new'], ['Answered', 'answered']]);
  expect(rows[1].target).toEqual({ href: '/m/indigo-mill/a/60219-1', label: 'Article 60219/1' });

  await own.delete(products).where(eq(products.id, DEMO.products.guess));
  expect((await listCompanyInquiries(own, DEMO.companies.indigo))[0].target).toEqual({ href: '/m/indigo-mill', label: 'Removed item' });
});
