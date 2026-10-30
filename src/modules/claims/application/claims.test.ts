import { expect, it } from 'vitest';
import { createProduct, createProductRepository, getProduct } from '@/modules/catalog';
import { createCompany, createSupplierRepositories, upsertArticle } from '@/modules/supplier';
import { createTestDb } from '@/shared/db/testing';
import { verifyClaim } from '../domain/claim';
import { createClaimRepository } from '../infrastructure/drizzle-claim-repository';
import { publishGarments } from './publish-garments';
import { verifyOriginalClaim } from './verify-original-claim';
import { withdrawClaim } from './withdraw-claim';

async function setup() {
  const db = await createTestDb();
  const { companies, articles } = createSupplierRepositories(db);
  const products = createProductRepository(db);
  const mill = async (name: string, owner: string) => {
    const c = createCompany({ name, city: 'Istanbul', country: 'TR', ownerUserId: owner, contact: { email: 'sales@x.test' } });
    await companies.save(c);
    return c.id;
  };
  const garment = async (brand: string, name: string, path: string) => {
    const p = createProduct({ canonicalUrl: `https://example.com/${path}`, sourceUrl: `https://example.com/${path}`, brand, name, imageUrl: null, composition: null });
    await products.save(p);
    return p.id;
  };
  const ids = {
    indigo: await mill('Indigo Mill', 'u1'),
    denizli: await mill('Denizli Indigo', 'u2'),
    guess: await garment('GUESS', 'Cropped Denim Blazer', 'guess'),
    liujo: await garment('LIU JO', 'Flared Jeans', 'liujo'),
  };
  const deps = {
    claims: createClaimRepository(db),
    getProduct: (id: string) => getProduct({ products }, id),
    upsertArticle: (i: { companyId: string; code: string }) => upsertArticle({ articles }, i),
  };
  return { deps, ids };
}

it('publishes a batch, re-publishing updates the same claim', async () => {
  const { deps, ids } = await setup();
  const [c1, c2] = await publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: '60219/1', kind: 'original' }, { productId: ids.liujo, articleCode: ' ', kind: 'equivalent' }] });
  expect(c1).toMatchObject({ kind: 'original', status: 'declared' }); expect(c1.articleId).not.toBeNull(); expect(c2.articleId).toBeNull();
  const [again] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: '60219/1', kind: 'equivalent' }] });
  expect(again.id).toBe(c1.id); expect(again.kind).toBe('equivalent');
});

it('persists claims and reads them back as plain domain objects', async () => {
  const { deps, ids } = await setup();
  const [c] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: '60219/1', kind: 'original', note: ' our 12oz ' }] });
  expect(c.note).toBe('our 12oz');
  expect(await deps.claims.findById(c.id)).toEqual(c);
  expect(await deps.claims.findByProductAndCompany(ids.guess, ids.indigo)).toEqual(c);
  expect(await deps.claims.findByProductAndCompany(ids.guess, ids.denizli)).toBeNull();
  expect([await deps.claims.existsForProduct(ids.guess), await deps.claims.existsForProduct(ids.liujo)]).toEqual([true, false]);
});

it('dedupes the same product within one batch (last wins, at its last position)', async () => {
  const { deps, ids } = await setup();
  const claims = await publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: null, kind: 'original' }, { productId: ids.liujo, articleCode: null, kind: 'original' }, { productId: ids.guess, articleCode: null, kind: 'equivalent' }] });
  expect(claims.map(c => [c.productId, c.kind])).toEqual([[ids.liujo, 'original'], [ids.guess, 'equivalent']]);
});

it('rejects empty or >50 item batches and unknown products', async () => {
  const { deps, ids } = await setup();
  await expect(publishGarments(deps, { companyId: ids.indigo, items: [] })).rejects.toMatchObject({ code: 'claims.batch_size_invalid' });
  await expect(publishGarments(deps, { companyId: ids.indigo, items: Array.from({ length: 51 }, () => ({ productId: ids.guess, articleCode: null, kind: 'original' as const })) }))
    .rejects.toMatchObject({ code: 'claims.batch_size_invalid' });
  await expect(publishGarments(deps, { companyId: ids.indigo, items: [{ productId: crypto.randomUUID(), articleCode: null, kind: 'original' }] }))
    .rejects.toMatchObject({ code: 'product.not_found' });
});

it('saves nothing when any item in the batch is invalid', async () => {
  const { deps, ids } = await setup();
  await expect(publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: null, kind: 'original' }, { productId: ids.liujo, articleCode: null, kind: 'original', note: 'x'.repeat(281) }] }))
    .rejects.toMatchObject({ code: 'claim.note_too_long' });
  await expect(publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: null, kind: 'original' }, { productId: crypto.randomUUID(), articleCode: null, kind: 'original' }] }))
    .rejects.toMatchObject({ code: 'product.not_found' });
  expect(await deps.claims.findByProductAndCompany(ids.guess, ids.indigo)).toBeNull();
});

it('allows one verified original per product', async () => {
  const { deps, ids } = await setup();
  const [a] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  const [b] = await publishGarments(deps, { companyId: ids.denizli, items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  expect((await verifyOriginalClaim(deps, a.id)).status).toBe('verified');
  await expect(verifyOriginalClaim(deps, b.id)).rejects.toMatchObject({ code: 'claim.already_verified_original' });
  await expect(deps.claims.save(verifyClaim(b))).rejects.toThrow(); // DB partial unique index
});

it('verifies idempotently, rejects missing claims and equivalents, and re-publishing unchanged keeps verification', async () => {
  const { deps, ids } = await setup();
  const [o, e] = await publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: '60219/1', kind: 'original' }, { productId: ids.liujo, articleCode: null, kind: 'equivalent' }] });
  await verifyOriginalClaim(deps, o.id);
  expect((await verifyOriginalClaim(deps, o.id)).status).toBe('verified');
  await expect(verifyOriginalClaim(deps, crypto.randomUUID())).rejects.toMatchObject({ code: 'claim.not_found' });
  await expect(verifyOriginalClaim(deps, e.id)).rejects.toMatchObject({ code: 'claim.only_original_verifiable' });
  const [same] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: '60219/1', kind: 'original', note: 'edited' }] });
  expect(same).toMatchObject({ id: o.id, status: 'verified', note: 'edited' });
  const [changed] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: '60219/2', kind: 'original' }] });
  expect(changed).toMatchObject({ id: o.id, status: 'declared' });
  expect(await deps.claims.findVerifiedOriginal(ids.guess)).toBeNull();
});

it('lets only the owning mill withdraw its claim', async () => {
  const { deps, ids } = await setup();
  const [c] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  await expect(withdrawClaim(deps, { companyId: ids.denizli, claimId: c.id })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect(await deps.claims.findById(c.id)).toEqual(c);
  await withdrawClaim(deps, { companyId: ids.indigo, claimId: c.id });
  expect(await deps.claims.findById(c.id)).toBeNull();
  await expect(withdrawClaim(deps, { companyId: ids.indigo, claimId: c.id })).rejects.toMatchObject({ code: 'claim.not_found' });
});
