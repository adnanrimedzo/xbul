import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCompany, createSupplierRepositories, saveRegistration } from '@/modules/supplier';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import type { Mailer } from '@/shared/mail/mailer';
import { removeCompanyDocumentAction, saveRegistrationAction, submitRegistrationAction, uploadCompanyDocumentAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// after() runs its task at once here; the test awaits what it started.
const afterTasks = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({ requireMill: async () => ({ userId: 'u1', company: {} }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: (task: () => unknown) => void afterTasks.push(Promise.resolve(task())) }));

const PDF = new TextEncoder().encode('%PDF-1.4\n%%EOF\n');
const FULL = {
  legalName: 'Aksu Denim Tekstil A.Ş.', taxId: '1234567890', registryNumber: '123456',
  registeredAddress: 'Atışalanı Cd. 1, Esenler', facilityAddress: 'OSB 5. Cd. 12, Çorlu', naceCodes: ['13.20'],
};
const formOf = (fields: Record<string, string | Blob>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
};
const upload = (kind: string) => uploadCompanyDocumentAction(null, formOf({ kind, file: new File([PDF], `${kind}.pdf`, { type: 'application/pdf' }) }));

beforeEach(() => void afterTasks.splice(0));
afterEach(() => vi.restoreAllMocks());

async function setup(mailer: Mailer = createRecordingMailer()) {
  const repos = createSupplierRepositories(await createTestDb());
  const company = createCompany({ name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'a@aksu.test' }, kind: 'fabric_mill' });
  await repos.companies.save(company);
  const stored = new Map<string, Uint8Array>();
  const evidenceStore = { put: async (k: string, b: Uint8Array) => void stored.set(k, b), get: async (k: string) => stored.get(k) ?? null, delete: async (k: string) => void stored.delete(k) };
  const config = { adminEmails: ['admin@xbul.test', 'ops@xbul.test'], baseUrl: 'https://xbul.test' };
  container.current = { ...repos, evidenceStore, mailer, config };
  const complete = async () => {
    await saveRegistration(repos, { userId: 'u1', input: FULL });
    for (const kind of ['tax_certificate', 'registry_extract', 'capacity_report']) expect(await upload(kind)).toEqual({ ok: true, data: undefined });
  };
  return { repos, company, stored, complete };
}

it('maps the form onto the registration: NACE codes split, blank certificate rows dropped', async () => {
  const { repos, company } = await setup();
  const form = formOf({
    legalName: ' Aksu Denim Tekstil A.Ş. ', taxId: '123 456 7890', naceCodes: '13.20, 13.30;1340\n14.11',
    cert0Scheme: 'gots', cert0Number: 'CU123', cert0ValidUntil: '2027-06-30',
    cert1Scheme: '', cert1Number: '', cert1ValidUntil: '',
    cert2Scheme: 'oeko_tex_100', cert2Number: '21.HTR.1', cert2ValidUntil: '',
  });
  expect(await saveRegistrationAction(null, form)).toEqual({ ok: true, data: undefined });
  expect(await repos.registrations.find(company.id)).toMatchObject({
    legalName: 'Aksu Denim Tekstil A.Ş.',
    taxId: '1234567890',
    naceCodes: ['13.20', '13.30', '13.40', '14.11'],
    certifications: [
      { scheme: 'gots', number: 'CU123', validUntil: '2027-06-30' },
      { scheme: 'oeko_tex_100', number: '21.HTR.1', validUntil: null },
    ],
  });
});

it('echoes what was typed on a domain error and saves nothing', async () => {
  const { repos, company } = await setup();
  const result = await saveRegistrationAction(null, formOf({ legalName: 'Aksu Denim', taxId: '123 456 7891', cert0Scheme: 'gots', cert0Number: 'CU1' }));
  expect(result).toEqual({
    ok: false,
    error: 'Enter a valid tax number for your country.',
    values: expect.objectContaining({ legalName: 'Aksu Denim', taxId: '123 456 7891', cert0Scheme: 'gots', cert0Number: 'CU1', facilityAddress: '' }),
  });
  expect(await repos.registrations.find(company.id)).toBeNull();
});

it('uploads a document of the chosen kind, refuses a request with no file, and removes one', async () => {
  const { repos, company, stored } = await setup();
  expect(await upload('registry_extract')).toEqual({ ok: true, data: undefined });
  const [doc] = await repos.documents.listByCompany(company.id);
  expect(doc).toMatchObject({ kind: 'registry_extract', fileName: 'registry_extract.pdf' });
  expect(stored.get(doc!.storageKey)).toEqual(PDF);
  expect(await uploadCompanyDocumentAction(null, formOf({ kind: 'other' }))).toEqual({ ok: false, error: 'Upload a PDF, JPG or PNG file.' });

  expect(await removeCompanyDocumentAction('not-a-uuid')).toEqual({ ok: false, error: 'Something went wrong. Please try again.' });
  expect(await removeCompanyDocumentAction(doc!.id)).toEqual({ ok: true, data: undefined });
  expect(await repos.documents.listByCompany(company.id)).toEqual([]);
});

it('submits and emails every admin the review link', async () => {
  const mailer = createRecordingMailer();
  const { repos, company, complete } = await setup(mailer);
  await complete();
  expect(await submitRegistrationAction()).toEqual({ ok: true, data: undefined });
  await Promise.all(afterTasks);
  expect((await repos.companies.findById(company.id))?.status).toBe('submitted');
  const text = `Aksu Denim (TR) submitted its registration.\n\nReview it: https://xbul.test/admin/manufacturers/${company.id}`;
  expect(mailer.sent).toEqual([
    { to: 'admin@xbul.test', subject: 'New manufacturer to review: Aksu Denim', text },
    { to: 'ops@xbul.test', subject: 'New manufacturer to review: Aksu Denim', text },
  ]);
});

it('keeps the submission when an email fails, logging it and still mailing the other admins', async () => {
  const sent: string[] = [];
  const mailer: Mailer = {
    send: async ({ to }) => {
      if (to === 'admin@xbul.test') throw new Error('smtp down');
      sent.push(to);
    },
  };
  const { repos, company, complete } = await setup(mailer);
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  await complete();
  expect(await submitRegistrationAction()).toEqual({ ok: true, data: undefined });
  await Promise.all(afterTasks);
  expect((await repos.companies.findById(company.id))?.status).toBe('submitted');
  expect(sent).toEqual(['ops@xbul.test']);
  expect(logged).toHaveBeenCalledWith(expect.stringContaining('admin@xbul.test'), expect.any(Error));
});

it('says what is wrong with an incomplete submission and emails nobody', async () => {
  const mailer = createRecordingMailer();
  await setup(mailer);
  expect(await submitRegistrationAction()).toEqual({ ok: false, error: 'Complete the missing items before you submit.' });
  expect(afterTasks).toEqual([]);
  expect(mailer.sent).toEqual([]);
});
