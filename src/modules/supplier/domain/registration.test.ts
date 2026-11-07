import { expect, it } from 'vitest';
import { createCompany, type Company, type CompanyStatus } from './company';
import { approveCompany, diffRegistration, missingForSubmit, normalizeRegistration, rejectCompany, requestCompanyChanges, submitCompany } from './registration';

const TR = {
  legalName: 'Aksu Denim Tekstil San. ve Tic. A.Ş.', taxId: '123 456 7890', taxOffice: 'Esenler', registryNumber: '123456',
  mersisNumber: '0123456789000015', industryRegistryNumber: '34-123456', lei: null,
  registeredAddress: 'Atışalanı Cd. 1, Esenler, İstanbul', facilityAddress: 'OSB 5. Cd. 12, Çorlu, Tekirdağ',
  naceCodes: ['13.20.01', '1330'], employees: '50-249', monthlyCapacity: '300,000 m',
  certifications: [{ scheme: 'oeko_tex_100', number: '21.HTR.12345', validUntil: '2027-06-30' }], openSupplyHubId: null,
};
const ALL_TR_DOCS = ['tax_certificate', 'registry_extract', 'capacity_report'] as const;
const fresh = (owner = 'u1'): Company =>
  createCompany({ name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: owner, contact: { email: 'a@aksu.test' }, kind: 'fabric_mill' });
const at = (status: CompanyStatus, owner = 'u1'): Company => ({ ...fresh(owner), status });

it('a new company starts as a draft', () => expect(fresh().status).toBe('draft'));

it('normalizes a Turkish registration', () => {
  expect(normalizeRegistration('TR', 'c1', TR)).toMatchObject({ taxId: '1234567890', naceCodes: ['13.20.01', '13.30'], employees: '50-249' });
});

it('saves half-filled drafts', () => {
  expect(normalizeRegistration('TR', 'c1', { legalName: 'Aksu' })).toMatchObject({ legalName: 'Aksu', taxId: null, naceCodes: [] });
});

it.each([
  [{ legalName: 'A' }, 'registration.legal_name_invalid'],
  [{ taxId: '1234567891' }, 'registration.tax_id_invalid'],
  [{ mersisNumber: '123' }, 'registration.mersis_invalid'],
  [{ lei: '5493001KJTIIGC8Y1R13' }, 'registration.lei_invalid'],
  [{ naceCodes: ['x'] }, 'registration.nace_invalid'],
  [{ employees: 'lots' }, 'registration.employees_invalid'],
  [{ facilityAddress: 'x'.repeat(301) }, 'registration.text_too_long'],
  [{ certifications: [{ scheme: 'gots', number: '', validUntil: null }] }, 'registration.certification_invalid'],
  [{ certifications: [{ scheme: 'gots', number: 'CU123', validUntil: '2027-02-30' }] }, 'registration.certification_invalid'],
])('rejects %j', (patch, code) =>
  expect(() => normalizeRegistration('TR', 'c1', { ...TR, ...patch })).toThrow(expect.objectContaining({ code })));

it('lists what is missing before a submit, in a fixed order', () => {
  expect(missingForSubmit('TR', null, [])).toEqual([
    'legal_name', 'tax_id', 'registry_number', 'registered_address', 'facility_address', 'nace_manufacturing',
    'doc:tax_certificate', 'doc:registry_extract', 'doc:manufacturing_proof',
  ]);
  const reg = normalizeRegistration('TR', 'c1', TR);
  expect(missingForSubmit('TR', reg, ALL_TR_DOCS)).toEqual([]);
  expect(missingForSubmit('TR', { ...reg, naceCodes: ['46.41'] }, ALL_TR_DOCS)).toEqual(['nace_manufacturing']);
  expect(missingForSubmit('DE', normalizeRegistration('DE', 'c1', { ...TR, taxId: 'DE123456789', mersisNumber: null }), ['registry_extract', 'facility_photo'])).toEqual([]);
});

it('walks the review states', () => {
  expect(submitCompany(at('draft'), [])).toMatchObject({ company: { status: 'submitted' }, event: { action: 'submitted', actorUserId: 'u1' } });
  expect(submitCompany(at('changes_requested'), []).company.status).toBe('submitted');
  expect(approveCompany(at('submitted'), 'admin').company.status).toBe('approved');
  expect(requestCompanyChanges(at('submitted'), 'admin', ' Upload the capacity report ').event).toMatchObject({ action: 'changes_requested', note: 'Upload the capacity report' });
  expect(rejectCompany(at('approved'), 'admin', 'A trader, not a manufacturer').company.status).toBe('rejected');
});

it.each([
  [() => submitCompany(at('draft'), ['tax_id']), 'registration.incomplete'],
  [() => submitCompany(at('submitted'), []), 'registration.locked'],
  [() => approveCompany(at('draft'), 'admin'), 'registration.not_submitted'],
  [() => requestCompanyChanges(at('approved'), 'admin', 'x'), 'registration.not_submitted'],
  [() => rejectCompany(at('draft'), 'admin', 'x'), 'registration.not_submitted'],
  [() => rejectCompany(at('submitted'), 'admin', '  '), 'review.note_invalid'],
  [() => approveCompany(at('submitted', 'admin'), 'admin'), 'review.own_company'],
])('refuses %#', (run, code) => expect(run).toThrow(expect.objectContaining({ code })));

it('diffs registrations regardless of object key order', () => {
  const after = normalizeRegistration('TR', 'c1', TR);
  // Postgres jsonb hands keys back as number, scheme, validUntil.
  const before = { ...after, certifications: [{ number: '21.HTR.12345', scheme: 'oeko_tex_100', validUntil: '2027-06-30' }] } as unknown as typeof after;
  expect(diffRegistration(before, after)).toEqual({});
  expect(diffRegistration(before, { ...after, taxOffice: 'Beşiktaş' })).toEqual({ taxOffice: ['Esenler', 'Beşiktaş'] });
});
