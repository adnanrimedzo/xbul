import { beforeEach, expect, it, vi } from 'vitest';
import { registrationFormValues } from '@/app/[lang]/m/[company]/registration/registration-values';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import { approveRegistrationAction, editRegistrationAction, rejectRegistrationAction, requestChangesAction, rerunChecksAction } from './actions';

const container = vi.hoisted(() => ({ current: null as unknown }));
// `refuse` makes requireAdmin throw, as it does when it redirects a visitor who is not an admin.
const viewer = vi.hoisted(() => ({ refuse: null as Error | null }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
vi.mock('@/server/viewer', () => ({
  requireAdmin: async () => {
    if (viewer.refuse) throw viewer.refuse;
    return { userId: 'admin-1' };
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const GENERIC = 'Something went wrong. Please try again.';
const NOTE_INVALID = 'Add a note of up to 1000 characters.';
const OK = { ok: true, data: undefined };
const { ege, marmara } = DEMO.companies;
const formOf = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
};

beforeEach(() => {
  viewer.refuse = null;
});

// Ege Örme and Marmara Denim are submitted in the seed, with no documents.
async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const repos = createSupplierRepositories(db);
  const mailer = createRecordingMailer();
  const evidenceStore = { put: async () => {}, get: async () => null, delete: async () => {} };
  const checker = vi.fn(async () => null);
  container.current = { ...repos, evidenceStore, mailer, config: { baseUrl: 'https://xbul.test' }, checkers: [checker], ownerEmail: async () => 'pending@example.test' };
  const status = async (id: string) => (await repos.companies.findById(id))?.status;
  return { repos, mailer, checker, status };
}

it('approves a registration for the admin who decided, and tells the owner', async () => {
  const { repos, mailer, status } = await setup();
  expect(await approveRegistrationAction(ege)).toEqual(OK);
  expect(await status(ege)).toBe('approved');
  expect((await repos.reviewEvents.listByCompany(ege)).map((e) => [e.action, e.actorUserId])).toEqual([['approved', 'admin-1']]);
  expect(mailer.sent.map((m) => m.to)).toEqual(['pending@example.test']);
});

it('asks for changes or rejects only with a note', async () => {
  const { status } = await setup();
  for (const form of [formOf({ note: '   ' }), formOf({ note: 'x'.repeat(1001) }), new FormData()]) {
    expect(await rejectRegistrationAction(ege, null, form)).toEqual({ ok: false, error: NOTE_INVALID });
    expect(await requestChangesAction(ege, null, form)).toEqual({ ok: false, error: NOTE_INVALID });
  }
  expect(await status(ege)).toBe('submitted');
  expect(await requestChangesAction(ege, null, formOf({ note: 'Upload your kapasite raporu.' }))).toEqual(OK);
  expect(await status(ege)).toBe('changes_requested');
  expect(await rejectRegistrationAction(marmara, null, formOf({ note: 'Not a manufacturer.' }))).toEqual(OK);
  expect(await status(marmara)).toBe('rejected');
});

it('edits the registration with the owner form’s fields, keeps the status, and logs the change', async () => {
  const { repos, status } = await setup();
  const before = await repos.registrations.find(ege);
  const fields = { ...registrationFormValues(before), legalName: 'Ege Örme Tekstil A.Ş.' };
  expect(await editRegistrationAction(ege, null, formOf(fields))).toEqual(OK);
  expect(await repos.registrations.find(ege)).toMatchObject({ ...before, legalName: 'Ege Örme Tekstil A.Ş.', updatedAt: expect.any(Date) });
  expect((await repos.reviewEvents.listByCompany(ege)).map((e) => [e.action, e.actorUserId, e.changes])).toEqual([
    ['edited', 'admin-1', { legalName: [before?.legalName, 'Ege Örme Tekstil A.Ş.'] }],
  ]);
  expect(await status(ege)).toBe('submitted');
  // A domain error comes back with what was typed, so the form keeps it.
  expect(await editRegistrationAction(ege, null, formOf({ ...fields, taxId: '123 456 7891' }))).toMatchObject({
    ok: false, error: 'Enter a valid tax number for your country.', values: { taxId: '123 456 7891' },
  });
});

it('re-runs the checks and stores the latest result per source', async () => {
  const { repos, checker } = await setup();
  expect(await rerunChecksAction(ege)).toEqual(OK);
  expect(checker).toHaveBeenCalledOnce();
  expect((await repos.checks.list(ege)).map((c) => [c.source, c.outcome])).toContainEqual(['tax_id_format', 'pass']);
});

it('refuses a non-admin before reading anything, and changes nothing', async () => {
  const { status, checker } = await setup();
  viewer.refuse = new Error('NEXT_REDIRECT');
  container.current = null; // a guard that ran second would fail on this instead
  const note = formOf({ note: 'no' });
  await expect(approveRegistrationAction(ege)).rejects.toThrow('NEXT_REDIRECT');
  await expect(rejectRegistrationAction(ege, null, note)).rejects.toThrow('NEXT_REDIRECT');
  await expect(requestChangesAction(ege, null, note)).rejects.toThrow('NEXT_REDIRECT');
  await expect(editRegistrationAction(ege, null, formOf({ legalName: 'Taken Over' }))).rejects.toThrow('NEXT_REDIRECT');
  await expect(rerunChecksAction(ege)).rejects.toThrow('NEXT_REDIRECT');
  expect(await status(ege)).toBe('submitted');
  expect(checker).not.toHaveBeenCalled();
});

it('answers an id that is not a uuid with the generic error', async () => {
  await setup();
  const note = formOf({ note: 'no' });
  expect(await approveRegistrationAction('not-a-uuid')).toEqual({ ok: false, error: GENERIC });
  expect(await rejectRegistrationAction('not-a-uuid', null, note)).toEqual({ ok: false, error: GENERIC });
  expect(await requestChangesAction('not-a-uuid', null, note)).toEqual({ ok: false, error: GENERIC });
  expect(await editRegistrationAction('not-a-uuid', null, formOf({}))).toMatchObject({ ok: false, error: GENERIC });
  expect(await rerunChecksAction('not-a-uuid')).toEqual({ ok: false, error: GENERIC });
});

it('says a company that no longer exists is gone', async () => {
  await setup();
  expect(await approveRegistrationAction(crypto.randomUUID())).toEqual({ ok: false, error: 'That company no longer exists.' });
});
