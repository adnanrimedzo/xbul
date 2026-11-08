import { expect, it } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createCompany, type CompanyStatus } from '../domain/company';
import { createCompanyDocument } from '../domain/company-document';
import { normalizeRegistration } from '../domain/registration';
import { createSupplierRepositories } from '../infrastructure/drizzle-repositories';
import { saveRegistration, submitRegistration } from './registration';

const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const FULL = {
  legalName: 'Aksu Denim Tekstil A.Ş.', taxId: '123 456 7890', registryNumber: '123456',
  registeredAddress: 'Atışalanı Cd. 1, Esenler, İstanbul', facilityAddress: 'OSB 5. Cd. 12, Çorlu', naceCodes: ['13.20'],
};

async function setup() {
  const repos = createSupplierRepositories(await createTestDb());
  const company = createCompany({ name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'a@aksu.test' }, kind: 'fabric_mill' });
  await repos.companies.save(company);
  const addDocs = async (kinds: string[]) => {
    for (const kind of kinds) await repos.documents.save(createCompanyDocument({ companyId: company.id, kind, fileName: `${kind}.pdf`, bytes: PDF }));
  };
  const save = (input = FULL) => saveRegistration(repos, { userId: 'u1', input });
  const submit = () => submitRegistration(repos, { userId: 'u1' });
  return { repos, company, addDocs, save, submit };
}

it('saves the owner’s draft, normalized', async () => {
  const { repos, company, save } = await setup();
  const saved = await save();
  expect(saved).toMatchObject({ companyId: company.id, taxId: '1234567890', naceCodes: ['13.20'] });
  expect(await repos.registrations.find(company.id)).toEqual(saved);
});

it('refuses a save once submitted, and from a user with no company', async () => {
  const { repos, company, save } = await setup();
  await repos.companies.save({ ...company, status: 'submitted' });
  await expect(save()).rejects.toMatchObject({ code: 'registration.locked' });
  await expect(saveRegistration(repos, { userId: 'nobody', input: FULL })).rejects.toMatchObject({ code: 'auth.forbidden' });
  await expect(submitRegistration(repos, { userId: 'nobody' })).rejects.toMatchObject({ code: 'auth.forbidden' });
});

it('submits a complete registration and logs it once', async () => {
  const { repos, company, addDocs, save, submit } = await setup();
  await save();
  await addDocs(['tax_certificate', 'registry_extract', 'capacity_report']);
  expect(await submit()).toMatchObject({ id: company.id, status: 'submitted' });
  expect((await repos.companies.findById(company.id))?.status).toBe('submitted');
  expect(await repos.reviewEvents.listByCompany(company.id)).toEqual([
    expect.objectContaining({ action: 'submitted', actorUserId: 'u1', note: null }),
  ]);
});

it('refuses a submit while a document group is missing', async () => {
  const { repos, company, addDocs, save, submit } = await setup();
  await save();
  await addDocs(['tax_certificate', 'registry_extract']); // no industry registry or capacity report
  await expect(submit()).rejects.toMatchObject({ code: 'registration.incomplete' });
  expect((await repos.companies.findById(company.id))?.status).toBe('draft');
  expect(await repos.reviewEvents.listByCompany(company.id)).toEqual([]);
});

it.each([
  ['submitted', 'registration.tax_id_taken'],
  ['approved', 'registration.tax_id_taken'],
  ['rejected', null], // a rejected holder doesn't block it
] as const)('a tax number already held by a %s company in the same country: %s', async (status: CompanyStatus, code) => {
  const { repos, company, addDocs, save, submit } = await setup();
  const holder = createCompany({ name: 'Other Mill', city: 'Bursa', country: 'TR', ownerUserId: 'u2', contact: { email: 'o@other.test' }, kind: 'fabric_mill' });
  await repos.companies.save({ ...holder, status });
  await repos.registrations.save(normalizeRegistration('TR', holder.id, FULL));
  await save();
  await addDocs(['tax_certificate', 'registry_extract', 'capacity_report']);
  if (code) {
    await expect(submit()).rejects.toMatchObject({ code });
    expect((await repos.companies.findById(company.id))?.status).toBe('draft');
  } else {
    expect((await submit()).status).toBe('submitted');
  }
});
