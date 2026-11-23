import { beforeEach, expect, it, vi } from 'vitest';
import { companies, createSupplierRepositories } from '@/modules/supplier';
import { createFakePhotoModel, createPhotoCheckRepository, createSupplierPhotoRepository, MAX_PHOTO_BYTES, uploadSupplierPhoto, publishSupplierPhoto } from '@/modules/photos';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { eq } from 'drizzle-orm';
import { GET as getSearchPhoto } from '@/app/api/photo-searches/[id]/route';
import { GET as getSupplierPhoto } from '@/app/api/supplier-photos/[id]/route';
import { addCloseUpAction, checkPhotoAction } from './actions';
import { deleteSupplierPhotoAction, publishSupplierPhotoAction, uploadSupplierPhotoAction } from '../m/[company]/photos/actions';

// The buyer and supplier photo actions and both image routes, on PGlite with the fake model and an in-memory bucket.
const container = vi.hoisted(() => ({ current: null as unknown }));
const session = vi.hoisted(() => ({ viewer: null as { userId: string; isAdmin: boolean } | null, mill: '' }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  getViewer: async () => session.viewer,
  requireMill: async () => ({ userId: 'user', company: { id: session.mill, slug: 'indigo-mill' } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.9' }) }));

function jpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
}
const form = (bytes: Uint8Array | null, extra: Record<string, string | string[]> = {}) => {
  const f = new FormData();
  if (bytes !== null) f.set('photo', new File([bytes as BlobPart], 'photo.jpg', { type: 'image/jpeg' }));
  for (const [k, v] of Object.entries(extra)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

let stored: Map<string, Uint8Array>;
async function setup({ publicSearch = true } = {}) {
  const db = await createTestDb();
  await seedDemo(db);
  stored = new Map();
  const evidenceStore = { put: async (k: string, b: Uint8Array) => void stored.set(k, b), get: async (k: string) => stored.get(k) ?? null, delete: async (k: string) => void stored.delete(k) };
  const { articles, companies: companyRepo } = createSupplierRepositories(db);
  const model = createFakePhotoModel();
  container.current = {
    db, evidenceStore, articles, companies: companyRepo, photoModel: model, photoSearchPublic: publicSearch,
    supplierPhotos: createSupplierPhotoRepository(db), photoChecks: createPhotoCheckRepository(db), config: { authSecret: 's'.repeat(32) },
  };
  return { db, deps: { model, store: evidenceStore, photos: createSupplierPhotoRepository(db), checks: createPhotoCheckRepository(db), articles } };
}

beforeEach(() => {
  session.viewer = null;
  session.mill = DEMO.companies.indigo;
});

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

it('checks a buyer photo and says what it shows before any search', async () => {
  await setup();
  const r = await checkPhotoAction(form(jpeg(600, 750)));
  expect(r).toMatchObject({ ok: true, data: { decision: 'accepted', labels: ['Jacket or blazer', 'Blue', 'Woven', 'Twill', 'Denim'] } });
  const no = await checkPhotoAction(form(jpeg(640, 480)));
  expect(no).toEqual({ ok: true, data: { id: expect.any(String), decision: 'rejected', reason: 'not_textile', labels: [] } });
});

it('refuses a missing, oversized or non-JPEG photo without reading it, and is off until launched', async () => {
  await setup();
  expect(await checkPhotoAction(form(null))).toEqual({ ok: false, error: 'Choose a JPG, PNG or WebP photo.' });
  const read = vi.spyOn(Blob.prototype, 'arrayBuffer');
  expect(await checkPhotoAction(form(new Uint8Array(MAX_PHOTO_BYTES + 1)))).toMatchObject({ ok: false, error: expect.stringContaining('too large') });
  expect(read).not.toHaveBeenCalled();
  read.mockRestore();
  expect(await checkPhotoAction(form(new TextEncoder().encode('%PDF-1.7')))).toEqual({ ok: false, error: 'Choose a JPG, PNG or WebP photo.' });
  expect(await checkPhotoAction(form(jpeg(333, 333)))).toEqual({ ok: false, error: 'Photo search is busy. Try again in a minute.' });
  await setup({ publicSearch: false });
  expect(await checkPhotoAction(form(jpeg(600, 750)))).toMatchObject({ ok: false });
});

it('adds a close-up and returns the richer labels', async () => {
  await setup();
  const r = await checkPhotoAction(form(jpeg(600, 750)));
  if (!r.ok) throw new Error(r.error);
  const c = await addCloseUpAction(r.data.id, form(jpeg(700, 700)));
  expect(c).toMatchObject({ ok: true, data: { decision: 'accepted' } });
  if (c.ok) expect(c.data.labels).toEqual(expect.arrayContaining(['3/1 right-hand twill (RHT)', 'Rope-dyed']));
  expect(await addCloseUpAction('not-a-uuid', form(jpeg(700, 700)))).toEqual({ ok: false, error: 'That photo no longer exists.' });
});

it('serves a buyer photo privately while the search lasts, else an empty 404', async () => {
  await setup();
  const r = await checkPhotoAction(form(jpeg(600, 750)));
  if (!r.ok) throw new Error(r.error);
  const ok = await getSearchPhoto(new Request('http://x.test'), params(r.data.id));
  expect(ok.status).toBe(200);
  expect(Object.fromEntries(ok.headers)).toMatchObject({ 'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=3600' });
  const rejected = await checkPhotoAction(form(jpeg(640, 480)));
  for (const id of ['nope', crypto.randomUUID(), rejected.ok ? rejected.data.id : '']) {
    const res = await getSearchPhoto(new Request('http://x.test'), params(id));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  }
});

it('lets a supplier upload, publish and delete only its own photos', async () => {
  const { deps } = await setup();
  const up = await uploadSupplierPhotoAction(form(jpeg(601, 751)));
  expect(up).toEqual({ ok: true, data: { decision: 'accepted', reason: null } });
  expect(await uploadSupplierPhotoAction(form(jpeg(640, 480)))).toEqual({ ok: true, data: { decision: 'rejected', reason: 'not_textile' } });
  const [photo] = await deps.photos.listByCompany(DEMO.companies.indigo);
  const tags = { category: 'garment', productType: 'jacket', colors: ['blue', 'navy'], construction: 'woven', pattern: 'twill', twillRatio: '3/1', denim: 'yes', articleId: DEMO.articles.indigo60219 };
  session.mill = DEMO.companies.bursa;
  expect(await publishSupplierPhotoAction(photo.id, null, form(null, tags))).toEqual({ ok: false, error: 'That photo no longer exists.' });
  session.mill = DEMO.companies.indigo;
  expect(await publishSupplierPhotoAction(photo.id, null, form(null, { ...tags, colors: ['a', 'b'] }))).toEqual({ ok: false, error: 'Choose up to 3 colours from the list.' });
  expect(await publishSupplierPhotoAction(photo.id, null, form(null, tags))).toEqual({ ok: true, data: undefined });
  expect(await deps.photos.findById(photo.id)).toMatchObject({ status: 'published', articleId: DEMO.articles.indigo60219, tags: { colors: ['blue', 'navy'], fabric: { twillRatio: '3/1', denim: true } } });
  session.mill = DEMO.companies.bursa;
  expect(await deleteSupplierPhotoAction(photo.id)).toEqual({ ok: false, error: 'That photo no longer exists.' });
  session.mill = DEMO.companies.indigo;
  expect(await deleteSupplierPhotoAction(photo.id)).toEqual({ ok: true, data: undefined });
  expect(stored.size).toBe(0);
});

it('serves a supplier photo publicly once published by an approved company, otherwise to its owner and admins only', async () => {
  const { db, deps } = await setup();
  const r = await uploadSupplierPhoto(deps, { companyId: DEMO.companies.indigo, bytes: jpeg(601, 751) });
  if (r.decision === 'rejected') throw new Error('unreachable');
  const get = () => getSupplierPhoto(new Request('http://x.test'), params(r.photo.id));

  expect((await get()).status).toBe(404); // a draft, to a visitor
  session.viewer = { userId: DEMO.users.mill, isAdmin: false };
  const owner = await get();
  expect(owner.status).toBe(200);
  expect(owner.headers.get('cache-control')).toBe('private, no-store');
  session.viewer = { userId: 'someone', isAdmin: true };
  expect((await get()).status).toBe(200);

  session.viewer = null;
  await publishSupplierPhoto(deps, { companyId: DEMO.companies.indigo, photoId: r.photo.id, tags: { category: 'garment' }, articleId: null });
  const pub = await get();
  expect(pub.status).toBe(200);
  expect(Object.fromEntries(pub.headers)).toMatchObject({ 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff', 'content-type': 'image/jpeg' });

  await db.update(companies).set({ status: 'rejected' }).where(eq(companies.id, DEMO.companies.indigo));
  expect((await get()).status).toBe(404);
  expect((await getSupplierPhoto(new Request('http://x.test'), params('nope'))).status).toBe(404);
});
