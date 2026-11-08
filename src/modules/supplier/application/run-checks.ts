import { localChecks, type CheckResult, type CheckSubject } from '../domain/checks';
import type { CheckRepository, CompanyRepository, RegistrationRepository } from '../domain/repositories';
import type { RegistryChecker } from './ports';

export type RunChecksDeps = {
  companies: CompanyRepository;
  registrations: RegistrationRepository;
  checks: CheckRepository;
  checkers: readonly RegistryChecker[];
  ownerEmail: (userId: string) => Promise<string | null>;
};

// Runs every check and stores the latest result per source, replacing the last run. A failing checker is logged and skipped.
export async function runRegistrationChecks(deps: RunChecksDeps, companyId: string): Promise<CheckResult[]> {
  const company = await deps.companies.findById(companyId);
  if (!company) return [];
  const registration = await deps.registrations.find(companyId);
  const subject: CheckSubject = {
    country: company.country,
    legalName: registration?.legalName ?? null,
    taxId: registration?.taxId ?? null,
    mersisNumber: registration?.mersisNumber ?? null,
    lei: registration?.lei ?? null,
    naceCodes: registration?.naceCodes ?? [],
    website: company.contact.website,
    ownerEmail: await deps.ownerEmail(company.ownerUserId),
  };
  const settled = await Promise.allSettled(deps.checkers.map((check) => check(subject)));
  const remote: CheckResult[] = [];
  for (const s of settled) {
    if (s.status === 'rejected') console.error('[checks]', s.reason);
    else if (s.value) remote.push(s.value);
  }
  const results = [...localChecks(subject), ...remote];
  await deps.checks.replaceAll(companyId, results);
  return results;
}
