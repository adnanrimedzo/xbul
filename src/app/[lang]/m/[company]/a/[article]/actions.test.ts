import { expect, it, vi } from 'vitest';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { editArticleFabricAction, editArticleSpecsAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({ requireViewer: async () => ({ userId: 'demo-user-mill' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The form posts every field, so these are what the owner sees after saving.
const seeded = { weight: '12.5 oz', composition: '98% CO 2% EA', finish: 'Rigid · dark indigo', moq: '1,000 m', leadTimeWeeks: '3' };

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const repos = createSupplierRepositories(db);
  container.current = repos;
  const submit = (fields: Record<string, string>) => {
    const form = new FormData();
    form.set('articleId', DEMO.articles.indigo60219);
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    return editArticleSpecsAction(null, form);
  };
  const specs = async () => (await repos.articles.findById(DEMO.articles.indigo60219))!.specs;
  return { submit, specs };
}

it('saves a changed spec and keeps the rest', async () => {
  const { submit, specs } = await setup();
  expect(await submit({ ...seeded, moq: '1,500 m' })).toEqual({ ok: true, data: undefined });
  expect(await specs()).toEqual({ weight: '12.5 oz', composition: '98% CO 2% EA', finish: 'Rigid · dark indigo', moq: '1,500 m', leadTimeWeeks: 3 });
});

it('clears every field the owner blanks, lead time included', async () => {
  const { submit, specs } = await setup();
  expect(await submit({ weight: '', composition: '', finish: '', moq: '', leadTimeWeeks: '' })).toEqual({ ok: true, data: undefined });
  expect(await specs()).toEqual({ weight: null, composition: null, finish: null, moq: null, leadTimeWeeks: null });
});

it('shows the domain’s copy when a text spec is too long, and saves nothing', async () => {
  const { submit, specs } = await setup();
  expect(await submit({ ...seeded, moq: 'x'.repeat(61) })).toEqual({
    ok: false,
    error: 'Weight and MOQ must be 60 characters or fewer, composition 120 and finish 80.',
  });
  expect((await specs()).moq).toBe('1,000 m');
});

const sheet = { construction: 'woven', pattern: 'twill', twillRatio: '3/1', twillDirection: 'rht', fibre0: 'CO', percent0: '98', fibre1: 'EA', percent1: '2', fibre2: '', percent2: '', weight: '12.5', weightUnit: 'oz', widthCm: '150', dye: 'rope' };

it('saves a technical sheet from the form, then clears it with an empty construction', async () => {
  await setup();
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    f.set('articleId', DEMO.articles.indigo60219);
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    f.append('finishes', 'sanforized');
    return f;
  };
  expect(await editArticleFabricAction(null, form(sheet))).toEqual({ ok: true, data: undefined });
  const repos = container.current as ReturnType<typeof createSupplierRepositories>;
  expect((await repos.articles.findById(DEMO.articles.indigo60219))!.fabric).toMatchObject({ weightGsm: 424, fibres: [{ code: 'CO', percent: 98 }, { code: 'EL', percent: 2 }], finishes: ['sanforized'] });
  expect(await editArticleFabricAction(null, form({ construction: '' }))).toEqual({ ok: true, data: undefined });
  expect((await repos.articles.findById(DEMO.articles.indigo60219))!.fabric).toBeNull();
});

it('shows the domain’s copy when the fibres do not add up', async () => {
  await setup();
  const f = new FormData();
  f.set('articleId', DEMO.articles.indigo60219);
  for (const [k, v] of Object.entries({ ...sheet, percent1: '5' })) f.set(k, v);
  expect(await editArticleFabricAction(null, f)).toEqual({ ok: false, error: 'Fibre percentages must add up to 100.' });
});
