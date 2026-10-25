import { DomainError } from '@/shared/domain/errors';
import { createCompany, type Company } from '../domain/company';
import type { CompanyRepository } from '../domain/repositories';

export async function registerCompany(
  deps: { companies: CompanyRepository },
  input: { name: string; city: string; country: string; ownerUserId: string },
): Promise<Company> {
  if (await deps.companies.findByOwner(input.ownerUserId)) throw new DomainError('company.already_registered');
  const company = createCompany(input);
  let slug = company.slug;
  for (let n = 2; await deps.companies.slugExists(slug); n++) slug = `${company.slug}-${n}`;
  const saved = Object.freeze({ ...company, slug });
  await deps.companies.save(saved);
  return saved;
}
