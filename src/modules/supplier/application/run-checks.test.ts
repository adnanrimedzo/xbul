import { expect, it, vi } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createCompany } from '../domain/company';
import { normalizeRegistration } from '../domain/registration';
import type { CheckResult } from '../domain/checks';
import { createSupplierRepositories } from '../infrastructure/drizzle-repositories';
import { runRegistrationChecks } from './run-checks';
import type { RegistryChecker } from './ports';

const result = (source: 'eu_vies' | 'gleif'): CheckResult => ({ source, outcome: 'pass', summary: 'ok', checkedAt: new Date() });

async function setup(checkers: RegistryChecker[]) {
  const repos = createSupplierRepositories(await createTestDb());
  const company = createCompany({ name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { website: 'aksu.test' }, kind: 'fabric_mill' });
  await repos.companies.save(company);
  await repos.registrations.save(normalizeRegistration('TR', company.id, {
    legalName: 'Aksu Denim Tekstil A.Ş.', taxId: '1234567890', registryNumber: '1',
    registeredAddress: 'a', facilityAddress: 'b', naceCodes: ['13.20'],
  }));
  const run = (id = company.id) => runRegistrationChecks({ ...repos, checkers, ownerEmail: async () => 'ali@aksu.test' }, id);
  return { repos, company, run };
}

it('stores the local checks plus the checker results, surviving a throwing and a null checker', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { repos, company, run } = await setup([async () => result('eu_vies'), async () => { throw new Error('boom'); }, async () => null]);
  const out = await run();
  expect(out.map((r) => r.source)).toEqual(['tax_id_format', 'mersis_matches_tax_id', 'nace_manufacturing', 'email_domain', 'eu_vies']);
  expect((await repos.checks.list(company.id)).map((r) => [r.source, r.outcome])).toEqual(out.map((r) => [r.source, r.outcome]));
  expect(out.find((r) => r.source === 'email_domain')?.outcome).toBe('pass');
  expect(logged).toHaveBeenCalledWith('[checks]', expect.any(Error));
  logged.mockRestore();
});

it('replaces what was stored on a re-run', async () => {
  let call = 0;
  const { repos, company, run } = await setup([async () => (call++ === 0 ? result('eu_vies') : null)]);
  await run();
  await run();
  expect((await repos.checks.list(company.id)).map((r) => r.source)).not.toContain('eu_vies');
});

it('returns nothing and stores nothing for a missing company', async () => {
  const { repos, run } = await setup([]);
  const id = crypto.randomUUID();
  expect(await run(id)).toEqual([]);
  expect(await repos.checks.list(id)).toEqual([]);
});
