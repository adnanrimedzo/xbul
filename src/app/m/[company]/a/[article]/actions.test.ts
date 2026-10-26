import { expect, it, vi } from 'vitest';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { editArticleSpecsAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({ requireViewer: async () => ({ userId: 'demo-user-mill' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// The form posts every field, so these are what the owner sees after saving.
const seeded = { weightOz: '12.5', composition: '98% CO 2% EA', finish: 'Rigid · dark indigo', moqMeters: '1000', leadTimeWeeks: '3' };

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

it('saves a changed number and keeps the rest', async () => {
  const { submit, specs } = await setup();
  expect(await submit({ ...seeded, moqMeters: '1500' })).toEqual({ ok: true, data: undefined });
  expect(await specs()).toEqual({ weightOz: 12.5, composition: '98% CO 2% EA', finish: 'Rigid · dark indigo', moqMeters: 1500, leadTimeWeeks: 3 });
});

it('clears every field the owner blanks, numbers included', async () => {
  const { submit, specs } = await setup();
  expect(await submit({ weightOz: '', composition: '', finish: '', moqMeters: '', leadTimeWeeks: '' })).toEqual({ ok: true, data: undefined });
  expect(await specs()).toEqual({ weightOz: null, composition: null, finish: null, moqMeters: null, leadTimeWeeks: null });
});
