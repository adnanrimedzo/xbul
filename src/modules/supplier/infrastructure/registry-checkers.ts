import type { RegistryChecker } from '../application/ports';
import { legalNameMatches, type CheckOutcome, type CheckResult, type CheckSource } from '../domain/checks';
import { VIES_MEMBER_STATE } from '../domain/legal-identifiers';

const VIES = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms';
const GLEIF = 'https://api.gleif.org/api/v1/lei-records';

const result = (source: CheckSource, outcome: CheckOutcome, summary: string): CheckResult => ({ source, outcome, summary, checkedAt: new Date() });
const call = (fetchFn: typeof fetch, url: string) => fetchFn(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });

export function createViesChecker(fetchFn: typeof fetch = fetch): RegistryChecker {
  const unknown = (why: string) => result('eu_vies', 'unknown', `VIES: ${why}`);
  return async (s) => {
    const ms = VIES_MEMBER_STATE[s.country.toUpperCase()];
    if (!ms || !s.taxId) return null;
    try {
      const number = s.taxId.startsWith(ms) ? s.taxId.slice(ms.length) : s.taxId;
      const res = await call(fetchFn, `${VIES}/${ms}/vat/${encodeURIComponent(number)}`);
      if (!res.ok) return unknown('the service is unavailable, try again later');
      const body = (await res.json()) as { isValid?: boolean; userError?: string; name?: string };
      if (body.isValid === true) {
        const name = body.name?.trim();
        if (!name || name === '---') return result('eu_vies', 'pass', "VIES: valid, the member state doesn't share the name");
        return s.legalName && legalNameMatches(s.legalName, name)
          ? result('eu_vies', 'pass', 'VIES: valid, name matches')
          : unknown('valid, but the registered name differs from the legal name entered');
      }
      if (body.userError === 'INVALID') return result('eu_vies', 'fail', 'VIES: the VAT number is not registered');
      return unknown('the member state could not answer, try again later');
    } catch {
      return unknown('the service did not answer, try again later');
    }
  };
}

type GleifRecord = {
  attributes?: {
    lei?: string;
    entity?: { legalName?: { name?: string }; status?: string; legalAddress?: { country?: string } };
    registration?: { status?: string };
  };
};

export function createGleifChecker(fetchFn: typeof fetch = fetch): RegistryChecker {
  const unknown = (why: string) => result('gleif', 'unknown', `GLEIF: ${why}`);
  const sameFirm = (r: GleifRecord, s: { country: string; legalName: string | null }) => {
    const e = r.attributes?.entity;
    return !!s.legalName && !!e?.legalName?.name && legalNameMatches(s.legalName, e.legalName.name) &&
      e.legalAddress?.country?.toUpperCase() === s.country.toUpperCase();
  };

  return async (s) => {
    try {
      if (s.lei) {
        const res = await call(fetchFn, `${GLEIF}/${encodeURIComponent(s.lei)}`);
        if (res.status === 404) return result('gleif', 'fail', `GLEIF: LEI ${s.lei} does not exist`);
        if (!res.ok) return unknown('the service is unavailable, try again later');
        const rec = ((await res.json()) as { data?: GleifRecord }).data;
        const a = rec?.attributes;
        if (!a) return unknown('the answer could not be read');
        const state = `${a.entity?.status}/${a.registration?.status}`;
        if (state !== 'ACTIVE/ISSUED') return unknown(`LEI ${s.lei} is ${state.replace('/', ' / ')}, not ACTIVE / ISSUED`);
        return sameFirm(rec, s)
          ? result('gleif', 'pass', `GLEIF: LEI ${s.lei} is ACTIVE/ISSUED and matches`)
          : unknown(`LEI ${s.lei} is active but its name or country differs from the registration`);
      }
      if (!s.legalName) return null;
      const url = `${GLEIF}?filter[fulltext]=${encodeURIComponent(s.legalName)}&filter[entity.legalAddress.country]=${encodeURIComponent(s.country.toUpperCase())}&page[size]=5`;
      const res = await call(fetchFn, url);
      if (!res.ok) return null;
      const found = ((await res.json()) as { data?: GleifRecord[] }).data?.find((r) => sameFirm(r, s));
      return found ? result('gleif', 'pass', `GLEIF: found LEI ${found.attributes?.lei} for this name and country`) : null;
    } catch {
      return s.lei ? unknown('the service did not answer, try again later') : null;
    }
  };
}
