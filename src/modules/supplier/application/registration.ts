import { DomainError } from '@/shared/domain/errors';
import type { Company } from '../domain/company';
import { assertOwnerCanEdit, missingForSubmit, normalizeRegistration, submitCompany, type Registration, type RegistrationInput } from '../domain/registration';
import type { CompanyDocumentRepository, CompanyRepository, RegistrationRepository, ReviewEventRepository } from '../domain/repositories';

// The company is the caller's own, found by owner, so no company id ever comes from the caller.
async function ownCompany(companies: CompanyRepository, userId: string): Promise<Company> {
  const company = await companies.findByOwner(userId);
  if (!company) throw new DomainError('auth.forbidden');
  return company;
}

export async function saveRegistration(
  deps: { companies: CompanyRepository; registrations: RegistrationRepository },
  input: { userId: string; input: RegistrationInput },
): Promise<Registration> {
  const company = await ownCompany(deps.companies, input.userId);
  assertOwnerCanEdit(company);
  const registration = normalizeRegistration(company.country, company.id, input.input);
  await deps.registrations.save(registration);
  return registration;
}

export async function submitRegistration(
  deps: { companies: CompanyRepository; registrations: RegistrationRepository; documents: CompanyDocumentRepository; reviewEvents: ReviewEventRepository },
  input: { userId: string },
): Promise<Company> {
  const company = await ownCompany(deps.companies, input.userId);
  const [registration, documents] = await Promise.all([deps.registrations.find(company.id), deps.documents.listByCompany(company.id)]);
  const missing = missingForSubmit(company.country, registration, documents.map((d) => d.kind));
  if (registration?.taxId && (await deps.registrations.taxIdTaken(company.country, registration.taxId, company.id))) {
    throw new DomainError('registration.tax_id_taken');
  }
  const { company: submitted, event } = submitCompany(company, missing);
  await deps.companies.save(submitted);
  await deps.reviewEvents.add(event);
  return submitted;
}
