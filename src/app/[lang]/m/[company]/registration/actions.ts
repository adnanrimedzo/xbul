'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { actionLang } from '@/i18n/action';
import { errorMessage } from '@/app/_lib/error-messages';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { addCompanyDocument, removeCompanyDocument, runRegistrationChecks, saveRegistration, submitRegistration, type Company } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { DomainError } from '@/shared/domain/errors';
import { MAX_UPLOAD_BYTES } from '@/shared/domain/uploaded-file';
import { readRegistrationForm, toRegistrationInput, type RegistrationValues } from './registration-values';

// The company is always the viewer's own: every use case finds it by owner, never from the form.
export async function saveRegistrationAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult & { values?: RegistrationValues }> {
  const { userId } = await requireMill();
  const values = readRegistrationForm(form);
  const { companies, registrations } = await getContainer();
  try {
    await saveRegistration({ companies, registrations }, { userId, input: toRegistrationInput(values) });
  } catch (e) {
    return { ...toActionError(e, await actionLang()), values }; // React resets the form after an action; keep what was typed
  }
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}

const documentDeps = async () => {
  const { companies, documents, evidenceStore } = await getContainer();
  return { companies, documents, store: evidenceStore };
};

export async function uploadCompanyDocumentAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { userId } = await requireMill();
  const kind = form.get('kind');
  const file = form.get('file');
  if (!(file instanceof File)) return toActionError(new DomainError('evidence.type_invalid'), await actionLang()); // no file at all
  // The size is known without reading the file, so an oversized one costs nothing.
  if (file.size > MAX_UPLOAD_BYTES) return toActionError(new DomainError('evidence.too_large'), await actionLang());
  try {
    await addCompanyDocument(await documentDeps(), {
      userId,
      kind: typeof kind === 'string' ? kind : '',
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}

export async function removeCompanyDocumentAction(documentId: string): Promise<ActionResult> {
  const { userId } = await requireMill();
  if (!z.uuid().safeParse(documentId).success) return { ok: false, error: errorMessage('generic', await actionLang()) };
  try {
    await removeCompanyDocument(await documentDeps(), { userId, documentId });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  revalidatePath('/', 'layout');
  return { ok: true, data: undefined };
}

export async function submitRegistrationAction(): Promise<ActionResult> {
  const { userId } = await requireMill();
  const { companies, registrations, documents, reviewEvents, checks, checkers, ownerEmail, mailer, config } = await getContainer();
  let company: Company;
  try {
    company = await submitRegistration({ companies, registrations, documents, reviewEvents }, { userId });
  } catch (e) {
    return toActionError(e, await actionLang());
  }
  // After the response: a slow or failing mail server never holds up or undoes the submission.
  after(async () => {
    const subject = `New manufacturer to review: ${company.name}`;
    const text = `${company.name} (${company.country}) submitted its registration.\n\nReview it: ${config.baseUrl}/admin/manufacturers/${company.id}`;
    for (const to of config.adminEmails) {
      try {
        await mailer.send({ to, subject, text });
      } catch (e) {
        console.error(`[registration] could not email ${to} about ${company.id}`, e);
      }
    }
  });
  // Its own callback, so a mail failure and a checks failure can't affect each other.
  after(() => runRegistrationChecks({ companies, registrations, checks, checkers, ownerEmail }, company.id).catch((e) => console.error('[checks]', e)));
  revalidatePath('/', 'layout'); // the banner here and on the company page
  return { ok: true, data: undefined };
}
