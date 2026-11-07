import { expect, it, vi } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { newId } from '@/shared/domain/ids';
import type { Mailer } from '@/shared/mail/mailer';
import { createCompany } from '../domain/company';
import { createCompanyDocument } from '../domain/company-document';
import { normalizeRegistration } from '../domain/registration';
import { createSupplierRepositories } from '../infrastructure/drizzle-repositories';
import { saveRegistration } from './registration';
import { approveRegistration, editRegistrationAsAdmin, rejectRegistration, requestRegistrationChanges, type ReviewDeps } from './review-registration';

const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const FULL = {
  legalName: 'Aksu Denim Tekstil A.Ş.', taxId: '123 456 7890', taxOffice: 'Esenler', registryNumber: '123456',
  registeredAddress: 'Atışalanı Cd. 1, Esenler, İstanbul', facilityAddress: 'OSB 5. Cd. 12, Çorlu', naceCodes: ['13.20'],
};

async function setup(status: 'submitted' | 'approved' = 'submitted') {
  const repos = createSupplierRepositories(await createTestDb());
  const company = { ...createCompany({ name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'a@aksu.test' }, kind: 'fabric_mill' }), status };
  await repos.companies.save(company);
  await repos.registrations.save(normalizeRegistration('TR', company.id, FULL));
  const doc = createCompanyDocument({ companyId: company.id, kind: 'tax_certificate', fileName: 'vergi.pdf', bytes: PDF });
  await repos.documents.save(doc);
  const files = new Map<string, Uint8Array>([[doc.storageKey, PDF]]);
  const store = {
    put: async (k: string, b: Uint8Array) => void files.set(k, b),
    get: async (k: string) => files.get(k) ?? null,
    delete: async (k: string) => void files.delete(k),
  };
  const mailer = { send: vi.fn<Mailer['send']>(async () => {}) };
  const deps: ReviewDeps = { ...repos, store, mailer, ownerEmail: async () => 'owner@aksu.test', baseUrl: 'https://xbul.test' };
  return { repos, company, files, mailer, deps };
}

it('approves: logs the reviewed documents, purges them and emails the owner', async () => {
  const { repos, company, files, mailer, deps } = await setup();
  expect(await approveRegistration(deps, { companyId: company.id, adminUserId: 'admin' })).toMatchObject({ status: 'approved' });
  expect((await repos.companies.findById(company.id))?.status).toBe('approved');
  expect(await repos.reviewEvents.listByCompany(company.id)).toEqual([
    expect.objectContaining({ action: 'approved', actorUserId: 'admin', changes: { documents: [['tax_certificate: vergi.pdf'], null] } }),
  ]);
  expect(await repos.documents.listByCompany(company.id)).toEqual([]);
  expect(files.size).toBe(0);
  expect(mailer.send).toHaveBeenCalledOnce();
  expect(mailer.send).toHaveBeenCalledWith({
    to: 'owner@aksu.test',
    subject: 'Your company is approved on xbul / Firmanız xbul’da onaylandı',
    text: 'Aksu Denim is approved. Your company and products are now public:\nhttps://xbul.test/m/aksu-denim\n\nAksu Denim onaylandı. Firmanız ve ürünleriniz artık herkese açık:\nhttps://xbul.test/tr/m/aksu-denim',
  });
});

it('rejects an approved company, purges its documents and needs a note', async () => {
  const { repos, company, files, mailer, deps } = await setup('approved');
  await expect(rejectRegistration(deps, { companyId: company.id, adminUserId: 'admin', note: '  ' })).rejects.toMatchObject({ code: 'review.note_invalid' });
  expect(files.size).toBe(1);
  expect(await rejectRegistration(deps, { companyId: company.id, adminUserId: 'admin', note: 'Fake papers' })).toMatchObject({ status: 'rejected' });
  expect(await repos.documents.listByCompany(company.id)).toEqual([]);
  expect(files.size).toBe(0);
  expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({
    subject: 'Your xbul registration was not approved / xbul kaydınız onaylanmadı',
    text: 'Aksu Denim was not approved:\n\nFake papers\n\nQuestions: hello@xbul.io\n\nAksu Denim onaylanmadı (yukarıdaki nota bakın). Sorularınız için: hello@xbul.io',
  }));
});

it('requests changes: keeps the documents, emails the note, and the owner can save again', async () => {
  const { repos, company, files, mailer, deps } = await setup();
  await requestRegistrationChanges(deps, { companyId: company.id, adminUserId: 'admin', note: 'Upload a newer certificate' });
  expect((await repos.companies.findById(company.id))?.status).toBe('changes_requested');
  expect(await repos.documents.listByCompany(company.id)).toHaveLength(1);
  expect(files.size).toBe(1);
  expect(await repos.reviewEvents.listByCompany(company.id)).toEqual([
    expect.objectContaining({ action: 'changes_requested', note: 'Upload a newer certificate', changes: null }),
  ]);
  expect(mailer.send).toHaveBeenCalledWith({
    to: 'owner@aksu.test',
    subject: 'xbul needs more information / xbul ek bilgi istiyor',
    text: 'We need more information before we can approve Aksu Denim:\n\nUpload a newer certificate\n\nUpdate your registration: https://xbul.test/m/aksu-denim/registration\n\nAksu Denim kaydını onaylamadan önce ek bilgiye ihtiyacımız var (yukarıdaki nota bakın): https://xbul.test/tr/m/aksu-denim/registration',
  });
  await expect(saveRegistration(deps, { userId: 'u1', input: FULL })).resolves.toBeDefined();
});

it('refuses an admin who owns the company, on every action', async () => {
  const { repos, company, deps } = await setup();
  const own = { companyId: company.id, adminUserId: 'u1' };
  await expect(approveRegistration(deps, own)).rejects.toMatchObject({ code: 'review.own_company' });
  await expect(rejectRegistration(deps, { ...own, note: 'x' })).rejects.toMatchObject({ code: 'review.own_company' });
  await expect(requestRegistrationChanges(deps, { ...own, note: 'x' })).rejects.toMatchObject({ code: 'review.own_company' });
  await expect(editRegistrationAsAdmin(deps, { ...own, input: FULL })).rejects.toMatchObject({ code: 'review.own_company' });
  expect((await repos.companies.findById(company.id))?.status).toBe('submitted');
  expect(await repos.reviewEvents.listByCompany(company.id)).toEqual([]);
});

it('a missing company is company.not_found', async () => {
  const { deps } = await setup();
  await expect(approveRegistration(deps, { companyId: newId(), adminUserId: 'admin' })).rejects.toMatchObject({ code: 'company.not_found' });
});

it('keeps the decision and logs when the email fails or the owner has no address', async () => {
  const { repos, company, mailer, deps } = await setup();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  mailer.send.mockRejectedValueOnce(new Error('smtp down'));
  await approveRegistration(deps, { companyId: company.id, adminUserId: 'admin' });
  expect((await repos.companies.findById(company.id))?.status).toBe('approved');
  expect(log).toHaveBeenCalledOnce();
  await rejectRegistration({ ...deps, ownerEmail: async () => null }, { companyId: company.id, adminUserId: 'admin', note: 'No' });
  expect((await repos.companies.findById(company.id))?.status).toBe('rejected');
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});

it('an admin edit logs exactly the changed fields and keeps the status', async () => {
  const { repos, company, deps } = await setup();
  await editRegistrationAsAdmin(deps, { companyId: company.id, adminUserId: 'admin', input: { ...FULL, taxOffice: 'Bayrampaşa', facilityAddress: 'New OSB 7, Çorlu' } });
  expect((await repos.companies.findById(company.id))?.status).toBe('submitted');
  expect((await repos.registrations.find(company.id))?.taxOffice).toBe('Bayrampaşa');
  const events = await repos.reviewEvents.listByCompany(company.id);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    action: 'edited', actorUserId: 'admin',
    changes: { taxOffice: ['Esenler', 'Bayrampaşa'], facilityAddress: ['OSB 5. Cd. 12, Çorlu', 'New OSB 7, Çorlu'] },
  });
  expect(Object.keys(events[0]!.changes!)).toHaveLength(2);
  await expect(editRegistrationAsAdmin(deps, { companyId: company.id, adminUserId: 'admin', input: { ...FULL, taxId: '123' } })).rejects.toMatchObject({ code: 'registration.tax_id_invalid' });
});
