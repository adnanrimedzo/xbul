import { beforeAll, expect, it } from 'vitest';
import type { Db } from '@/shared/db/client';
import { createTestDb } from '@/shared/db/testing';
import { createProduct, createProductRepository, createSearchLog } from '@/modules/catalog';
import { createClaimRepository, createEvidence, createEvidenceRepository, declareClaim, rejectReview, submitForReview } from '@/modules/claims';
import { createCompany, createSupplierRepositories, requestCompanyChanges, submitCompany } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import {
  getArticlePageView,
  getCompanyPageView,
  getPlatformStats,
  canSeeCompany,
  getProductPageView,
  getRegistrationReview,
  hasPublicClaims,
  listPendingReviews,
  listRecentlyTagged,
  listRegistrations,
} from '@/modules/discovery';

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedDemo(db);
});

it('splits the garment page into who made the fabric and who made the garment', async () => {
  const v = await getProductPageView(db, DEMO.products.guess);
  const part = (id: string) => v?.parts.find((p) => p.part === id);
  expect(part('fabric')?.originals.map((c) => [c.company.name, c.status, c.article?.code, c.article?.specs.moq])).toEqual([['Indigo Mill', 'verified', '60219/1', '1,000 m']]);
  expect(part('fabric')?.equivalents.map((c) => c.company.name)).toEqual(['Denizli Indigo', 'Bursa Weave']);
  expect(part('fabric')?.equivalents[0]).toMatchObject({ note: 'Same twill, 13 oz, rigid. Swatch in stock.', article: null });
  expect(part('garment')?.originals.map((c) => [c.company.name, c.company.kind, c.status])).toEqual([['Anka Garments', 'garment_maker', 'verified']]);
  expect(part('garment')?.equivalents).toEqual([]);
  // Contact details are public: every claim carries its supplier's, so a buyer needs no account to reach them.
  expect(part('fabric')?.originals[0]?.company.contact).toEqual({ email: 'sales@indigo-mill.example', phone: null, website: 'https://indigo-mill.example/' });
  expect(part('fabric')?.equivalents.map((c) => c.company.contact.email)).toEqual(['sales@denizli-indigo.example', 'sales@bursa-weave.example']);
  expect(v?.product).toMatchObject({ brand: 'GUESS', imageUrl: null, sourceUrl: 'https://guess.eu/en/cropped-denim-blazer-W5RN12' });
  expect(await getProductPageView(db, crypto.randomUUID())).toBeNull();
});

it('flags each part full or partial, in part order', async () => {
  const db2 = await createTestDb();
  await seedDemo(db2);
  const marmara = { ...createCompany({ name: 'Marmara Yıkama', city: 'Bursa', country: 'TR', ownerUserId: 'u-marmara', contact: { email: 'm@marmara.example' }, kind: 'laundry' }), id: crypto.randomUUID(), status: 'approved' as const };
  await createSupplierRepositories(db2).companies.save(marmara);
  await createClaimRepository(db2).save(declareClaim({ productId: DEMO.products.guess, companyId: marmara.id, articleId: null, kind: 'original', scope: 'washing' }));
  const v = await getProductPageView(db2, DEMO.products.guess);
  expect(v?.parts.map((p) => [p.part, p.full])).toEqual([['garment', true], ['fabric', false], ['washing', false]]);
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

it('lists the submitted registrations, longest waiting first, with their check counts', async () => {
  const rows = await listRegistrations(db, 'submitted');
  expect(rows.map((r) => r.name)).toEqual(['Ege Örme', 'Marmara Denim']);
  expect(rows[0]).toEqual({
    companyId: DEMO.companies.ege, slug: 'ege-orme', name: 'Ege Örme', kind: 'fabric_mill', country: 'TR', status: 'submitted',
    submittedAt: null, checks: { pass: 0, fail: 0, unknown: 0 },
  });
  expect(await listRegistrations(db, 'approved')).toHaveLength(4);
  expect(await listRegistrations(db, 'rejected')).toEqual([]);
});

it('gathers what an admin needs to review a registration', async () => {
  const review = await getRegistrationReview(db, DEMO.companies.ege);
  expect(review?.company).toMatchObject({ id: DEMO.companies.ege, name: 'Ege Örme', status: 'submitted', ownerUserId: DEMO.users.pending, ownerEmail: 'pending@example.test' });
  expect(review?.registration).toMatchObject({ companyId: DEMO.companies.ege, taxId: '4840847211', naceCodes: ['13.91'] });
  expect(review).toMatchObject({ documents: [], checks: [], events: [], missing: ['doc:tax_certificate', 'doc:registry_extract', 'doc:manufacturing_proof'] });
  expect(await getRegistrationReview(db, crypto.randomUUID())).toBeNull();
});

it('orders the history newest first, with who did it, and counts each check outcome', async () => {
  const own = await createTestDb();
  await seedDemo(own);
  const repos = createSupplierRepositories(own);
  const ege = (await repos.companies.findById(DEMO.companies.ege))!;
  const submitted = submitCompany({ ...ege, status: 'draft' }, [], new Date('2026-02-01T09:00:00Z')).event;
  await repos.reviewEvents.add(submitted);
  await repos.reviewEvents.add(requestCompanyChanges(ege, DEMO.users.mill, 'Upload the levha', new Date('2026-02-02T09:00:00Z')).event);
  const at = new Date('2026-02-01T10:00:00Z');
  await repos.checks.replaceAll(ege.id, [
    { source: 'tax_id_format', outcome: 'pass', summary: 'ok', checkedAt: at },
    { source: 'nace_manufacturing', outcome: 'pass', summary: 'ok', checkedAt: at },
    { source: 'email_domain', outcome: 'unknown', summary: '?', checkedAt: at },
  ]);
  const review = await getRegistrationReview(own, ege.id);
  expect(review?.events.map((e) => [e.action, e.actorEmail, e.note])).toEqual([
    ['changes_requested', 'mill@example.test', 'Upload the levha'],
    ['submitted', 'pending@example.test', null],
  ]);
  expect(review?.checks.map((c) => c.source)).toEqual(['tax_id_format', 'nace_manufacturing', 'email_domain']);
  expect((await listRegistrations(own, 'submitted')).find((r) => r.name === 'Ege Örme')).toMatchObject({ submittedAt: submitted.createdAt, checks: { pass: 2, fail: 0, unknown: 1 } });
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
  expect(await getPlatformStats(own)).toEqual({ suppliers: 4, pendingSuppliers: 2, taggedProducts: 3, searches: 4, matchedSearches: 2, distinctSearchers: 2 });
});

it('keeps companies that are not approved off every public view', async () => {
  const db2 = await createTestDb();
  await seedDemo(db2);
  const tile = async () => (await listRecentlyTagged(db2)).find((t) => t.productId === DEMO.products.liujo);
  const before = (await tile())?.equivalents;
  const gizli = { ...createCompany({ name: 'Gizli Mill', city: 'Bursa', country: 'TR', ownerUserId: 'u-gizli', contact: { email: 'g@gizli.example' }, kind: 'fabric_mill' }), id: crypto.randomUUID() };
  await createSupplierRepositories(db2).companies.save(gizli);
  const only = { ...createProduct({ canonicalUrl: 'https://gizli.example/p', sourceUrl: 'https://gizli.example/p', brand: 'GIZLI', name: 'Secret', imageUrl: null, composition: null }), id: crypto.randomUUID() };
  await createProductRepository(db2).save(only);
  const repo = createClaimRepository(db2);
  for (const [productId, kind] of [[DEMO.products.guess, 'original'], [DEMO.products.liujo, 'equivalent'], [only.id, 'equivalent']] as const) {
    await repo.save(declareClaim({ productId, companyId: gizli.id, articleId: null, kind, scope: 'fabric' }));
  }
  const v = await getProductPageView(db2, DEMO.products.guess);
  expect(v!.parts.flatMap((p) => [...p.originals, ...p.equivalents]).map((c) => c.company.name)).not.toContain('Gizli Mill');
  expect((await tile())?.equivalents).toBe(before);
  expect(await getProductPageView(db2, only.id)).toBeNull();
  expect(await hasPublicClaims(db2, only.id)).toBe(false);
  expect(await hasPublicClaims(db2, DEMO.products.guess)).toBe(true);
  expect((await listRecentlyTagged(db2, 50)).map((t) => t.brand)).not.toContain('GIZLI');
  expect(await getPlatformStats(db2)).toMatchObject({ suppliers: 4, taggedProducts: 3, pendingSuppliers: 2 }); // the two seeded submissions
  expect((await getCompanyPageView(db2, 'gizli-mill'))?.company.status).toBe('draft');
});

it.each([
  ['approved', null, true],
  ['draft', null, false],
  ['draft', { userId: 'u-gizli', isAdmin: false }, true],
  ['submitted', { userId: 'someone', isAdmin: false }, false],
  ['rejected', { userId: 'someone', isAdmin: true }, true],
] as const)('canSeeCompany(%s, %j) is %s', (status, viewer, expected) => expect(canSeeCompany({ status, ownerUserId: 'u-gizli' }, viewer)).toBe(expected));
