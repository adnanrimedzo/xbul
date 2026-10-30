import { expect, it } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createSupplierRepositories } from '../infrastructure/drizzle-repositories';
import { editArticleSpecs } from './edit-article-specs';
import { registerCompany } from './register-company';
import { updateCompanyContact } from './update-company-contact';
import { upsertArticle } from './upsert-article';

const contact = { email: 'sales@x.test' };

it('registers one company per owner', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact });
  await expect(registerCompany(repos, { name: 'Other', city: 'Bursa', country: 'TR', ownerUserId: 'u1', contact }))
    .rejects.toMatchObject({ code: 'company.already_registered' });
});

it('suffixes colliding company slugs', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const a = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact });
  const b = await registerCompany(repos, { name: 'INDIGO MILL', city: 'Izmir', country: 'TR', ownerUserId: 'u2', contact });
  expect([a.slug, b.slug]).toEqual(['indigo-mill', 'indigo-mill-2']);
});

it('upserts articles by normalized code and suffixes colliding slugs', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact });
  const a1 = await upsertArticle(repos, { companyId: c.id, code: ' 60219/1' });
  const a2 = await upsertArticle(repos, { companyId: c.id, code: '60219/1' });
  const a3 = await upsertArticle(repos, { companyId: c.id, code: '60219-1' });
  expect(a2.id).toBe(a1.id);
  expect([a1.slug, a3.slug]).toEqual(['60219-1', '60219-1-2']);
});

it('only the owner edits specs', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact });
  const a = await upsertArticle(repos, { companyId: c.id, code: '60219/1' });
  await expect(editArticleSpecs(repos, { userId: 'u2', articleId: a.id, specs: { moq: '10 m' } })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect((await editArticleSpecs(repos, { userId: 'u1', articleId: a.id, specs: { moq: '1,500 m' } })).specs.moq).toBe('1,500 m');
});

it('persists specs and reads back plain domain objects', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'tr', ownerUserId: 'u1', contact });
  const a = await upsertArticle(repos, { companyId: c.id, code: '60219/1' });
  await editArticleSpecs(repos, { userId: 'u1', articleId: a.id, specs: { weight: '12.5 oz', composition: '98% CO 2% EA', leadTimeWeeks: 6 } });
  expect(await repos.companies.findBySlug('indigo-mill')).toEqual(c);
  expect(await repos.companies.findByOwner('u1')).toEqual(c);
  expect(await repos.articles.findByCode(c.id, '60219/1')).toMatchObject({
    id: a.id,
    specs: { weight: '12.5 oz', composition: '98% CO 2% EA', finish: null, moq: null, leadTimeWeeks: 6 },
  });
  expect(Object.isFrozen(await repos.articles.findById(a.id))).toBe(true);
  expect(await repos.articles.findById('00000000-0000-4000-8000-000000000000')).toBeNull();
});

it('rejects spec edits for a missing article', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  await expect(editArticleSpecs(repos, { userId: 'u1', articleId: '00000000-0000-4000-8000-000000000000', specs: {} }))
    .rejects.toMatchObject({ code: 'article.not_found' });
});

it('the owner updates the contact details and a round trip returns them', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'sales@indigo.test' } });
  expect(c.contact).toEqual({ email: 'sales@indigo.test', phone: null, website: null });
  const updated = await updateCompanyContact(repos, { userId: 'u1', contact: { email: '', phone: '+90 212 555 0100', website: 'indigo.test' } });
  expect(updated.contact).toEqual({ email: null, phone: '+90 212 555 0100', website: 'https://indigo.test/' });
  expect(await repos.companies.findByOwner('u1')).toEqual(updated);
});

it('refuses to clear every contact detail', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'sales@indigo.test' } });
  await expect(updateCompanyContact(repos, { userId: 'u1', contact: {} })).rejects.toMatchObject({ code: 'company.contact_required' });
  expect((await repos.companies.findByOwner('u1'))?.contact.email).toBe('sales@indigo.test');
});

it('a user with no company cannot update contact details', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  await expect(updateCompanyContact(repos, { userId: 'nobody', contact: { email: 'x@y.test' } })).rejects.toMatchObject({ code: 'auth.forbidden' });
});
