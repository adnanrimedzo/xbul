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
