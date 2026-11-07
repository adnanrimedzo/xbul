import { describe, expect, it } from 'vitest';
import { CHECK_ORDER, type CheckSubject, legalNameMatches, localChecks } from './checks';

const S: CheckSubject = { country: 'TR', legalName: 'Aksu Denim Tekstil San. ve Tic. A.Ş.', taxId: '1234567890', mersisNumber: '0123456789000015', lei: null,
  naceCodes: ['13.20'], website: 'https://aksu-denim.com.tr/', ownerEmail: 'ali@aksu-denim.com.tr' };
const outcome = (s: Partial<CheckSubject>) => Object.fromEntries(localChecks({ ...S, ...s }).map((r) => [r.source, r.outcome]));

describe('localChecks', () => {
  it('passes a consistent Turkish manufacturer', () =>
    expect(outcome({})).toEqual({ tax_id_format: 'pass', mersis_matches_tax_id: 'pass', nace_manufacturing: 'pass', email_domain: 'pass' }));
  it('never fails on the MERSİS pattern, which only third parties document', () => expect(outcome({ mersisNumber: '0999999999000015' }).mersis_matches_tax_id).toBe('unknown'));
  it('fails a company with no manufacturing activity', () => expect(outcome({ naceCodes: ['46.41'] }).nace_manufacturing).toBe('fail'));
  it.each([['ali@gmail.com', 'unknown'], ['ali@sales.aksu-denim.com.tr', 'pass'], ['ali@other.com', 'unknown']])('email %s → %s', (ownerEmail, expected) =>
    expect(outcome({ ownerEmail }).email_domain).toBe(expected));
  it('has no email check without a website', () => expect(outcome({ website: null }).email_domain).toBe('unknown'));
  it('fails an invalid tax number and is unknown without one', () => {
    expect(outcome({ taxId: '1234567891' }).tax_id_format).toBe('fail');
    expect(outcome({ taxId: null })).toMatchObject({ tax_id_format: 'unknown', mersis_matches_tax_id: 'unknown' });
  });
  it('is unknown for a TCKN and for missing activity codes', () => {
    expect(outcome({ taxId: '10000000146' })).toMatchObject({ tax_id_format: 'pass', mersis_matches_tax_id: 'unknown' });
    expect(outcome({ naceCodes: [] }).nace_manufacturing).toBe('unknown');
  });
  it('lists all six sources in order', () =>
    expect(CHECK_ORDER).toEqual(['tax_id_format', 'mersis_matches_tax_id', 'nace_manufacturing', 'email_domain', 'eu_vies', 'gleif']));
});

describe('legalNameMatches', () => {
  it.each([
    ['AKSU DENİM TEKSTİL SANAYİ VE TİCARET ANONİM ŞİRKETİ', 'Aksu Denim Tekstil San. ve Tic. A.Ş.', true],
    ['Indigo Mill GmbH', 'INDIGO MILL', true],
    ['KOÇ HOLDİNG ANONİM ŞİRKETİ', 'Koc Holding A.S.', true],
    ['Indigo Mill GmbH', 'Indigo Weaving GmbH', false],
    ['Aksu Denim', 'Denim', false], // a one-word subset is too weak
    ['A.Ş.', 'Ltd. Şti.', false],
  ])('legalNameMatches(%s, %s) is %s', (a, b, expected) => expect(legalNameMatches(a, b)).toBe(expected));
});
