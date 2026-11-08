'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { actionLang } from '@/i18n/action';
import { errorMessage } from '@/app/_lib/error-messages';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { readRegistrationForm, toRegistrationInput, type RegistrationValues } from '@/app/[lang]/m/[company]/registration/registration-values';
import {
  approveRegistration, editRegistrationAsAdmin, rejectRegistration, requestRegistrationChanges, runRegistrationChecks, type ReviewDeps,
} from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireAdmin } from '@/server/viewer';

async function reviewDeps(): Promise<ReviewDeps> {
  const { companies, registrations, reviewEvents, documents, evidenceStore, mailer, ownerEmail, config } = await getContainer();
  return { companies, registrations, reviewEvents, documents, store: evidenceStore, mailer, ownerEmail, baseUrl: config.baseUrl };
}

// Every action goes through here: requireAdmin first, so nothing runs for anyone else; then the id; then the use case,
// with the viewer as the admin who decided. The use cases refuse an admin's own company.
async function run(companyId: string, work: (adminUserId: string) => Promise<unknown>): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  if (!z.uuid().safeParse(companyId).success) return { ok: false, error: errorMessage('generic', await actionLang()) };
  try {
    await work(userId);
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath('/', 'layout'); // the queue, this page, the owner's pages and, once approved, every public view
  return { ok: true, data: undefined };
}

const noteOf = (form: FormData) => {
  const note = form.get('note');
  return typeof note === 'string' ? note : ''; // the domain judges it; a missing field is as empty as a blank one
};

export async function approveRegistrationAction(companyId: string): Promise<ActionResult> {
  return run(companyId, async (adminUserId) => approveRegistration(await reviewDeps(), { companyId, adminUserId }));
}

export async function rejectRegistrationAction(companyId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(companyId, async (adminUserId) => rejectRegistration(await reviewDeps(), { companyId, adminUserId, note: noteOf(form) }));
}

export async function requestChangesAction(companyId: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(companyId, async (adminUserId) => requestRegistrationChanges(await reviewDeps(), { companyId, adminUserId, note: noteOf(form) }));
}

// The owner's registration form, filled in by an admin. Any status; the status stays as it is.
export async function editRegistrationAction(
  companyId: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult & { values?: RegistrationValues }> {
  const result = await run(companyId, async (adminUserId) => {
    const { companies, registrations, reviewEvents } = await getContainer();
    await editRegistrationAsAdmin({ companies, registrations, reviewEvents }, { companyId, adminUserId, input: toRegistrationInput(readRegistrationForm(form)) });
  });
  return result.ok ? result : { ...result, values: readRegistrationForm(form) }; // React resets the form after an action; keep what was typed
}

export async function rerunChecksAction(companyId: string): Promise<ActionResult> {
  return run(companyId, async () => {
    const { companies, registrations, checks, checkers, ownerEmail } = await getContainer();
    await runRegistrationChecks({ companies, registrations, checks, checkers, ownerEmail }, companyId);
  });
}
