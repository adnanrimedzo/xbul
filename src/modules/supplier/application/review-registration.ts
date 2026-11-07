import { DomainError } from '@/shared/domain/errors';
import type { Mailer } from '@/shared/mail/mailer';
import type { Company } from '../domain/company';
import {
  approveCompany, diffRegistration, editedEvent, normalizeRegistration, rejectCompany, requestCompanyChanges,
  type Registration, type RegistrationInput, type ReviewEvent,
} from '../domain/registration';
import type { CompanyDocumentRepository, CompanyRepository, RegistrationRepository, ReviewEventRepository } from '../domain/repositories';
import { purgeCompanyDocuments } from './company-documents';
import type { DocumentStore } from './ports';

export type ReviewDeps = {
  companies: CompanyRepository;
  registrations: RegistrationRepository;
  reviewEvents: ReviewEventRepository;
  documents: CompanyDocumentRepository;
  store: DocumentStore;
  mailer: Mailer;
  ownerEmail: (userId: string) => Promise<string | null>;
  baseUrl: string;
};

async function load(deps: Pick<ReviewDeps, 'companies'>, companyId: string): Promise<Company> {
  const company = await deps.companies.findById(companyId);
  if (!company) throw new DomainError('company.not_found');
  return company;
}

// The decision is already saved, so a missing address or a failed send is logged and never thrown.
async function notifyOwner(deps: ReviewDeps, company: Company, subject: string, text: string): Promise<void> {
  try {
    const to = await deps.ownerEmail(company.ownerUserId);
    if (!to) {
      console.error(`[review] no email for the owner of company ${company.id}`);
      return;
    }
    await deps.mailer.send({ to, subject, text });
  } catch (e) {
    console.error(`[review] could not email the owner of company ${company.id}`, e);
  }
}

// Saves the new status and event; for approve/reject also records which documents were reviewed, then deletes them.
async function decide(deps: ReviewDeps, result: { company: Company; event: ReviewEvent }, purge: boolean): Promise<Company> {
  const { company, event } = result;
  await deps.companies.save(company);
  if (!purge) {
    await deps.reviewEvents.add(event);
    return company;
  }
  const reviewed = (await deps.documents.listByCompany(company.id)).map((d) => `${d.kind}: ${d.fileName}`);
  await deps.reviewEvents.add({ ...event, changes: { documents: [reviewed, null] } });
  await purgeCompanyDocuments(deps, company.id);
  return company;
}

export async function approveRegistration(deps: ReviewDeps, input: { companyId: string; adminUserId: string }): Promise<Company> {
  const company = await load(deps, input.companyId);
  const { name, slug } = company;
  const approved = await decide(deps, approveCompany(company, input.adminUserId), true);
  await notifyOwner(
    deps, approved, 'Your company is approved on xbul / Firmanız xbul’da onaylandı',
    `${name} is approved. Your company and products are now public:\n${deps.baseUrl}/m/${slug}\n\n${name} onaylandı. Firmanız ve ürünleriniz artık herkese açık:\n${deps.baseUrl}/tr/m/${slug}`,
  );
  return approved;
}

export async function rejectRegistration(deps: ReviewDeps, input: { companyId: string; adminUserId: string; note: string }): Promise<Company> {
  const company = await load(deps, input.companyId);
  const result = rejectCompany(company, input.adminUserId, input.note);
  const rejected = await decide(deps, result, true);
  await notifyOwner(
    deps, rejected, 'Your xbul registration was not approved / xbul kaydınız onaylanmadı',
    `${company.name} was not approved:\n\n${result.event.note}\n\nQuestions: hello@xbul.io\n\n${company.name} onaylanmadı (yukarıdaki nota bakın). Sorularınız için: hello@xbul.io`,
  );
  return rejected;
}

export async function requestRegistrationChanges(deps: ReviewDeps, input: { companyId: string; adminUserId: string; note: string }): Promise<Company> {
  const company = await load(deps, input.companyId);
  const result = requestCompanyChanges(company, input.adminUserId, input.note);
  const updated = await decide(deps, result, false);
  const { name, slug } = company;
  await notifyOwner(
    deps, updated, 'xbul needs more information / xbul ek bilgi istiyor',
    `We need more information before we can approve ${name}:\n\n${result.event.note}\n\nUpdate your registration: ${deps.baseUrl}/m/${slug}/registration\n\n${name} kaydını onaylamadan önce ek bilgiye ihtiyacımız var (yukarıdaki nota bakın): ${deps.baseUrl}/tr/m/${slug}/registration`,
  );
  return updated;
}

export async function editRegistrationAsAdmin(
  deps: Pick<ReviewDeps, 'companies' | 'registrations' | 'reviewEvents'>,
  input: { companyId: string; adminUserId: string; input: RegistrationInput },
): Promise<Registration> {
  const company = await load(deps, input.companyId);
  const after = normalizeRegistration(company.country, company.id, input.input);
  const event = editedEvent(company, input.adminUserId, diffRegistration(await deps.registrations.find(company.id), after));
  await deps.registrations.save(after);
  await deps.reviewEvents.add(event);
  return after;
}
