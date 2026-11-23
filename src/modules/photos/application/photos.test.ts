import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/shared/db/client';
import { createTestDb } from '@/shared/db/testing';
import { seedDemo } from '@/server/seed-demo';
import { DEMO } from '@/server/demo-ids';
import { companies, createSupplierRepositories } from '@/modules/supplier';
import { findPhotoMatches } from '@/modules/discovery';
import { createPhotoCheckRepository, createSupplierPhotoRepository } from '../infrastructure/drizzle-repositories';
import { createFakePhotoModel, jpegSize } from '../infrastructure/fake-photo-model';
import { createWorkersAiPhotoModel } from '../infrastructure/workers-ai-photo-model';
import { COMPANY_DAILY_LIMIT, VISITOR_DAILY_LIMIT } from '../domain/photo-check';
import { NO_FILTERS } from '../domain/fabric-attributes';
import type { BuyerQuery } from '../domain/rank-matches';
import { addCloseUp, checkBuyerPhoto, findBuyerSearch, pruneExpiredSearches } from './buyer-photos';
import type { PhotoModel, PhotoStore } from './ports';
import { deleteSupplierPhoto, publishSupplierPhoto, unpublishSupplierPhoto, uploadSupplierPhoto } from './supplier-photos';

// A JPEG header with just a start-of-frame: enough for the sniffer and for the fake model's size lookup.
function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
}
const JACKET = jpeg(600, 750);
const SUPPLIER_JACKET = jpeg(601, 751);
const FABRIC = jpeg(700, 700);
const SWEATER = jpeg(640, 800);
const MUG = jpeg(640, 480);
const DARK = jpeg(500, 500);
const FAIL = jpeg(333, 333);

function memoryStore(): PhotoStore & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    put: vi.fn(async (k: string, b: Uint8Array) => void objects.set(k, b)),
    get: async (k: string) => objects.get(k) ?? null,
    delete: vi.fn(async (k: string) => void objects.delete(k)),
  };
}

let db: Db;
let store: ReturnType<typeof memoryStore>;
let model: PhotoModel;
const deps = () => {
  const { articles } = createSupplierRepositories(db);
  return { model, store, photos: createSupplierPhotoRepository(db), checks: createPhotoCheckRepository(db), articles };
};
const indigo = DEMO.companies.indigo;

beforeEach(async () => {
  db = await createTestDb();
  await seedDemo(db);
  store = memoryStore();
  model = createFakePhotoModel();
});

describe('fake model', () => {
  it('reads JPEG sizes', () => {
    expect(jpegSize(JACKET)).toBe('600x750');
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('supplier photos', () => {
  it('stores an accepted photo as a draft with suggested tags and logs the check', async () => {
    const r = await uploadSupplierPhoto(deps(), { companyId: indigo, bytes: SUPPLIER_JACKET });
    expect(r.decision).toBe('accepted');
    if (r.decision === 'rejected') throw new Error('unreachable');
    expect(r.photo).toMatchObject({ status: 'draft', tags: { category: 'garment', productType: 'jacket', colors: ['blue'], fabric: { construction: 'woven', pattern: 'twill', denim: true } } });
    expect(store.objects.get(r.photo.photoKey)).toEqual(SUPPLIER_JACKET);
    expect(await createPhotoCheckRepository(db).countSince({ companyId: indigo }, new Date(0))).toBe(1);
  });

  it('stores nothing for a rejected photo and says why', async () => {
    expect(await uploadSupplierPhoto(deps(), { companyId: indigo, bytes: MUG })).toEqual({ decision: 'rejected', reason: 'not_textile' });
    expect(store.put).not.toHaveBeenCalled();
    expect(await createSupplierPhotoRepository(db).countByCompany(indigo)).toBe(0);
  });

  it('refuses non-JPEG bytes and an unavailable model, storing nothing', async () => {
    await expect(uploadSupplierPhoto(deps(), { companyId: indigo, bytes: new TextEncoder().encode('%PDF-1.7') })).rejects.toThrow('photo.type_invalid');
    await expect(uploadSupplierPhoto(deps(), { companyId: indigo, bytes: FAIL })).rejects.toThrow('photo.ai_unavailable');
    expect(store.put).not.toHaveBeenCalled();
  });

  it('removes the stored file when saving the row fails', async () => {
    const d = { ...deps(), photos: { ...deps().photos, save: async () => { throw new Error('db down'); } } };
    await expect(uploadSupplierPhoto(d, { companyId: indigo, bytes: SUPPLIER_JACKET })).rejects.toThrow('db down');
    expect(store.objects.size).toBe(0);
  });

  it('enforces the daily check cap before calling the model', async () => {
    const spy = vi.spyOn(model, 'inspect');
    const d = { ...deps(), checks: { ...deps().checks, countSince: async () => COMPANY_DAILY_LIMIT } };
    await expect(uploadSupplierPhoto(d, { companyId: indigo, bytes: SUPPLIER_JACKET })).rejects.toThrow('photo.daily_limit');
    expect(spy).not.toHaveBeenCalled();
  });

  it('publishes reviewed tags, only for the owner and only with an own article', async () => {
    const r = await uploadSupplierPhoto(deps(), { companyId: indigo, bytes: SUPPLIER_JACKET });
    if (r.decision === 'rejected') throw new Error('unreachable');
    const tags = { category: 'garment', productType: 'jacket', colors: ['navy'], construction: 'woven', pattern: 'twill' };
    await expect(publishSupplierPhoto(deps(), { companyId: DEMO.companies.bursa, photoId: r.photo.id, tags, articleId: null })).rejects.toThrow('photo.not_found');
    const { articles } = createSupplierRepositories(db);
    const foreign = (await articles.findById(DEMO.articles.indigo60219))!;
    await expect(publishSupplierPhoto(deps(), { companyId: DEMO.companies.bursa, photoId: r.photo.id, tags, articleId: foreign.id })).rejects.toThrow('photo.not_found');
    await expect(publishSupplierPhoto(deps(), { companyId: indigo, photoId: r.photo.id, tags, articleId: 'not-an-article' })).rejects.toThrow('photo.article_invalid');
    const pub = await publishSupplierPhoto(deps(), { companyId: indigo, photoId: r.photo.id, tags, articleId: DEMO.articles.indigo60219 });
    expect(pub).toMatchObject({ status: 'published', articleId: DEMO.articles.indigo60219, tags: { colors: ['navy'] } });
    await unpublishSupplierPhoto(deps(), { companyId: indigo, photoId: r.photo.id });
    expect((await createSupplierPhotoRepository(db).findById(r.photo.id))?.status).toBe('draft');
  });

  it('deletes the row first, and only logs a file that will not delete', async () => {
    const r = await uploadSupplierPhoto(deps(), { companyId: indigo, bytes: SUPPLIER_JACKET });
    if (r.decision === 'rejected') throw new Error('unreachable');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = { ...deps(), store: { ...store, delete: async () => { throw new Error('r2 down'); } } };
    await deleteSupplierPhoto(d, { companyId: indigo, photoId: r.photo.id });
    expect(await createSupplierPhotoRepository(db).findById(r.photo.id)).toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining(r.photo.photoKey), expect.any(Error));
    log.mockRestore();
  });
});

describe('buyer photo search', () => {
  const now = new Date('2026-06-01T10:00:00Z');

  it('keeps an accepted photo and its vector, but never stores a rejected one', async () => {
    const ok = await checkBuyerPhoto(deps(), { visitorHash: 'v1', bytes: JACKET }, now);
    expect(ok.decision).toBe('accepted');
    const saved = await findBuyerSearch(deps(), ok.id, now);
    expect(saved?.photoKey).toBe(`photo-searches/20260601/${ok.id}`);
    expect(saved?.embedding).toHaveLength(768);
    const no = await checkBuyerPhoto(deps(), { visitorHash: 'v1', bytes: MUG }, now);
    expect(no).toMatchObject({ decision: 'rejected', reason: 'not_textile' });
    expect(await findBuyerSearch(deps(), no.id, now)).toMatchObject({ photoKey: null, embedding: null });
    expect(store.objects.size).toBe(1);
    expect((await checkBuyerPhoto(deps(), { visitorHash: 'v1', bytes: DARK }, now)).decision).toBe('unclear');
  });

  it('adds a fabric close-up to a live search, never stores it, and refuses rejected or unknown searches', async () => {
    const main = await checkBuyerPhoto(deps(), { visitorHash: 'v1', bytes: JACKET }, now);
    expect(await addCloseUp(deps(), { searchId: main.id, visitorHash: 'v1', bytes: FABRIC }, now)).toEqual({ decision: 'accepted', reason: null });
    expect((await findBuyerSearch(deps(), main.id, now))?.closeUp?.viewKind).toBe('close_up');
    expect(await addCloseUp(deps(), { searchId: main.id, visitorHash: 'v1', bytes: MUG }, now)).toMatchObject({ decision: 'rejected' });
    expect((await findBuyerSearch(deps(), main.id, now))?.closeUp?.viewKind).toBe('close_up');
    expect(store.objects.size).toBe(1);
    const no = await checkBuyerPhoto(deps(), { visitorHash: 'v1', bytes: MUG }, now);
    await expect(addCloseUp(deps(), { searchId: no.id, visitorHash: 'v1', bytes: FABRIC }, now)).rejects.toThrow('photo.not_found');
  });

  it('caps a visitor, and requests without an IP share one cap, before any model call', async () => {
    const spy = vi.spyOn(model, 'inspect');
    const counts: unknown[] = [];
    const d = { ...deps(), checks: { ...deps().checks, countSince: async (who: unknown) => (counts.push(who), VISITOR_DAILY_LIMIT) } };
    await expect(checkBuyerPhoto(d, { visitorHash: null, bytes: JACKET }, now)).rejects.toThrow('photo.daily_limit');
    expect(counts).toEqual([{ visitorHash: null }]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('forgets photos and vectors after 7 days but keeps the rows', async () => {
    const old = await checkBuyerPhoto(deps(), { visitorHash: 'v1', bytes: JACKET }, now);
    const later = new Date(now.getTime() + 8 * 24 * 3600 * 1000);
    expect(await findBuyerSearch(deps(), old.id, later)).toBeNull();
    expect(await pruneExpiredSearches(deps(), later)).toBe(1);
    expect(store.objects.size).toBe(0);
    expect(await createPhotoCheckRepository(db).findById(old.id)).toMatchObject({ photoKey: null, embedding: null, decision: 'accepted' });
    expect(await pruneExpiredSearches(deps(), later)).toBe(0);
  });
});

describe('findPhotoMatches', () => {
  async function publishJacket(companyId: string, articleId: string | null = null) {
    const r = await uploadSupplierPhoto(deps(), { companyId, bytes: SUPPLIER_JACKET });
    if (r.decision === 'rejected') throw new Error('unreachable');
    await publishSupplierPhoto(deps(), { companyId, photoId: r.photo.id, tags: { category: 'garment', productType: 'jacket', colors: ['blue'] }, articleId });
    return r.photo;
  }
  const query: BuyerQuery = { attributes: { construction: 'woven', pattern: 'twill', denim: true }, category: 'garment', productType: 'jacket', colors: ['blue'], filters: NO_FILTERS };
  const search = async (bytes: Uint8Array, q = query) => findPhotoMatches(db, { embedding: await model.embedImage(Buffer.from(bytes).toString('base64')), embeddingModel: model.embeddingModel, query: q });

  it('finds the same product, grouped by company, with reasons from the linked article', async () => {
    const { articles } = createSupplierRepositories(db);
    const a = (await articles.findById(DEMO.articles.indigo60219))!;
    await articles.save({ ...a, fabric: { construction: 'woven', pattern: 'twill', twill: { ratio: '3/1', direction: 'rht' }, fibres: [{ code: 'CO', percent: 100 }], weightGsm: 407, widthCm: null, dye: 'rope', finishes: [] } });
    await publishJacket(indigo, a.id);
    const r = await search(JACKET);
    expect(r).toHaveLength(1);
    expect(r[0].company.slug).toBe(DEMO.companySlugs.indigo);
    expect(r[0].matches[0]).toMatchObject({ label: 'same', article: { code: '60219/1' } });
    expect(r[0].matches[0].agree).toEqual(expect.arrayContaining(['construction', 'pattern', 'denim', 'productType', 'colors']));
  });

  it('ignores drafts, unapproved companies, other models and unrelated photos', async () => {
    await uploadSupplierPhoto(deps(), { companyId: indigo, bytes: SUPPLIER_JACKET }); // a draft
    await publishJacket(DEMO.companies.bursa);
    await db.update(companies).set({ status: 'rejected' }).where(eq(companies.id, DEMO.companies.bursa));
    expect(await search(JACKET)).toEqual([]);
    await publishJacket(indigo);
    expect(await search(SWEATER)).toEqual([]);
    expect(await findPhotoMatches(db, { embedding: await model.embedImage(Buffer.from(JACKET).toString('base64')), embeddingModel: 'other-model', query })).toEqual([]);
  });

  it('matches fabric close-ups to article specs when no photo is close enough', async () => {
    const { articles } = createSupplierRepositories(db);
    const a = (await articles.findById(DEMO.articles.indigo60219))!;
    await articles.save({ ...a, fabric: { construction: 'woven', pattern: 'twill', twill: { ratio: '3/1', direction: 'rht' }, fibres: [{ code: 'CO', percent: 100 }], weightGsm: 407, widthCm: null, dye: 'rope', finishes: [] } });
    const r = await search(FABRIC, { ...query, category: 'fabric', productType: null, attributes: { ...query.attributes, twillRatio: '3/1', twillDirection: 'rht' } });
    expect(r[0].matches[0]).toMatchObject({ label: 'spec', photoId: null, article: { code: '60219/1' } });
  });
});

describe('Workers AI adapter', () => {
  it('sends the image as a data URI with the verdict schema, and reads both answer shapes', async () => {
    const run = vi.fn(async (name: string) => (name.includes('embedding') ? { data: [{ embedding: [0.1, 0.2] }] } : { choices: [{ message: { content: '{"ok":1}' } }] }));
    const m = createWorkersAiPhotoModel({ run });
    expect(await m.inspect('QUJD')).toBe('{"ok":1}');
    expect(await m.embedImage('QUJD')).toEqual([0.1, 0.2]);
    const [model, input] = run.mock.calls[0] as unknown as [string, { messages: { content: unknown }[]; response_format: { type: string } }];
    expect(model).toBe('@cf/google/gemma-4-26b-a4b-it');
    expect(JSON.stringify(input.messages[1].content)).toContain('data:image/jpeg;base64,QUJD');
    expect(input.response_format.type).toBe('json_schema');
  });

  it('retries once, then reports the model as unavailable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValueOnce({ response: { textile: true } });
    expect(await createWorkersAiPhotoModel({ run }).inspect('x')).toEqual({ textile: true });
    const failing = vi.fn().mockRejectedValue(new Error('500'));
    await expect(createWorkersAiPhotoModel({ run: failing }).embedImage('x')).rejects.toThrow('photo.ai_unavailable');
    expect(failing).toHaveBeenCalledTimes(2);
    await expect(createWorkersAiPhotoModel({ run: async () => ({ data: [] }) }).embedImage('x')).rejects.toThrow('photo.ai_unavailable');
    log.mockRestore();
  });
});
