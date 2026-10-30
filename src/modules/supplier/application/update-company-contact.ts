import { DomainError } from '@/shared/domain/errors';
import { normalizeContact, type Company, type ContactInput } from '../domain/company';
import type { CompanyRepository } from '../domain/repositories';

// The company is the viewer's own, found by owner, so no company id ever comes from the caller.
export async function updateCompanyContact(
  deps: { companies: CompanyRepository },
  input: { userId: string; contact: ContactInput },
): Promise<Company> {
  const company = await deps.companies.findByOwner(input.userId);
  if (!company) throw new DomainError('auth.forbidden');
  const updated = Object.freeze({ ...company, contact: normalizeContact(input.contact) });
  await deps.companies.save(updated);
  return updated;
}
