import { beforeAll, expect, it } from 'vitest';
import type { Db } from '@/shared/db/client';
import { createTestDb } from '@/shared/db/testing';
import { createSearchLog } from '@/modules/catalog';
import { createClaimRepository, createEvidence, createEvidenceRepository, declareClaim, rejectReview, submitForReview } from '@/modules/claims';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import {
  getArticlePageView,
  getCompanyPageView,
  getPlatformStats,
  getProductPageView,
  listPendingReviews,
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
  // Each tile says where this mill's claim stands, so the owner is offered the right next step.
  expect(v?.garments.map((g) => [g.brand, g.claimStatus, g.reviewStatus])).toEqual([['LIU-JO', 'declared', 'none'], ['GUESS', 'verified', 'none']]);
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

it('lists the claims waiting for review, longest waiting first, with their files', async () => {
  const own = await createTestDb(); // the shared database stays as the other tests expect it
  await seedDemo(own);
  expect(await listPendingReviews(own)).toEqual([]); // a declared original is not in the queue until it is sent in
  const claims = createClaimRepository(own);
  const evidence = createEvidenceRepository(own);
  const pdf = new TextEncoder().encode('%PDF-1.7 demo');
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  const rival = declareClaim({ productId: DEMO.products.liujo, companyId: DEMO.companies.denizli, articleId: null, kind: 'original', scope: 'fabric' });
  await claims.save(rival);
  const indigo = (await claims.findByProductAndCompany(DEMO.products.liujo, DEMO.companies.indigo))!;
  const sendIn = async (claim: typeof rival, files: [string, Uint8Array][], at: string) => {
    for (const [i, [fileName, bytes]] of files.entries()) await evidence.save(createEvidence({ claimId: claim.id, fileName, bytes }, new Date(Date.parse(at) + i)));
    const pending = submitForReview(claim, new Date(at));
    await claims.save(pending);
    return pending;
  };
  const sentIndigo = await sendIn(indigo, [['invoice.pdf', pdf], ['order.png', png]], '2026-03-01T09:00:00Z');
  await sendIn(rival, [['rival.pdf', pdf]], '2026-02-01T09:00:00Z');
  const summary = async () => (await listPendingReviews(own)).map((r) => [r.company.name, r.scope, r.product.brand, r.evidence.map((e) => e.fileName)]);
  expect(await summary()).toEqual([['Denizli Indigo', 'fabric', 'LIU-JO', ['rival.pdf']], ['Indigo Mill', 'fabric', 'LIU-JO', ['invoice.pdf', 'order.png']]]);
  expect((await listPendingReviews(own))[1]?.evidence[0]).toEqual({ id: expect.any(String), fileName: 'invoice.pdf', sizeBytes: pdf.length });
  await claims.save(rejectReview(sentIndigo, 'admin1', 'Unreadable')); // a decided claim leaves the queue
  expect(await summary()).toEqual([['Denizli Indigo', 'fabric', 'LIU-JO', ['rival.pdf']]]);
});

it('seedDemo is idempotent', async () => {
  await seedDemo(db);
  expect((await getCompanyPageView(db, 'indigo-mill'))?.garments).toHaveLength(2);
});

it('counts suppliers, tagged products, searches and distinct searchers', async () => {
  const own = await createTestDb();
  await seedDemo(own);
  const log = createSearchLog(own);
  await log.record({ matched: true, visitorHash: 'a' });
  await log.record({ matched: false, visitorHash: 'a' });
  await log.record({ matched: true, visitorHash: 'b' });
  await log.record({ matched: false, visitorHash: null });
  expect(await getPlatformStats(own)).toEqual({ suppliers: 4, taggedProducts: 3, searches: 4, matchedSearches: 2, distinctSearchers: 2 });
});
