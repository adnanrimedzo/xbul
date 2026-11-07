import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import type { Company } from './company';
import { isManufacturingNace, isValidLei, normalizeNace, normalizeTaxId } from './legal-identifiers';

export type CompanyStatus = 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';

export type DocumentKind =
  | 'tax_certificate' | 'registry_extract' | 'signature_circular' | 'industry_registry'
  | 'capacity_report' | 'certificate' | 'facility_photo' | 'other';

// Each group needs at least one document of one of its kinds (spec §4).
export function requiredDocuments(country: string): readonly { key: string; anyOf: readonly DocumentKind[] }[] {
  if (country.toUpperCase() === 'TR') {
    return [
      { key: 'tax_certificate', anyOf: ['tax_certificate'] },
      { key: 'registry_extract', anyOf: ['registry_extract'] },
      { key: 'manufacturing_proof', anyOf: ['industry_registry', 'capacity_report'] },
    ];
  }
  return [
    { key: 'registry_extract', anyOf: ['registry_extract'] },
    { key: 'manufacturing_proof', anyOf: ['industry_registry', 'capacity_report', 'facility_photo', 'certificate'] },
  ];
}

const SCHEMES = ['oeko_tex_100', 'gots', 'ocs', 'grs', 'rcs', 'bluesign', 'iso_9001', 'iso_14001', 'amfori_bsci', 'smeta', 'wrap', 'other'] as const;
export type CertificationScheme = (typeof SCHEMES)[number];
const BANDS = ['1-9', '10-49', '50-249', '250+'] as const;
export type EmployeeBand = (typeof BANDS)[number];

export type Registration = Readonly<{
  companyId: string;
  legalName: string | null;
  taxId: string | null;
  taxOffice: string | null;
  registryNumber: string | null;
  mersisNumber: string | null;
  industryRegistryNumber: string | null;
  lei: string | null;
  registeredAddress: string | null;
  facilityAddress: string | null;
  monthlyCapacity: string | null;
  openSupplyHubId: string | null;
  employees: EmployeeBand | null;
  naceCodes: readonly string[];
  certifications: readonly { scheme: CertificationScheme; number: string; validUntil: string | null }[];
  updatedAt: Date;
}>;

export type RegistrationInput = {
  legalName?: string | null;
  taxId?: string | null;
  taxOffice?: string | null;
  registryNumber?: string | null;
  mersisNumber?: string | null;
  industryRegistryNumber?: string | null;
  lei?: string | null;
  registeredAddress?: string | null;
  facilityAddress?: string | null;
  monthlyCapacity?: string | null;
  openSupplyHubId?: string | null;
  employees?: string | null;
  naceCodes?: string[];
  certifications?: { scheme: string; number: string; validUntil?: string | null }[];
};

const blank = (v: string | null | undefined): string | null => v?.trim() || null;
const tooLong = () => new DomainError('registration.text_too_long');

const text = (v: string | null | undefined, max: number): string | null => {
  const s = blank(v);
  if (s !== null && s.length > max) throw tooLong();
  return s;
};

const realDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

export function normalizeRegistration(country: string, companyId: string, input: RegistrationInput, now: Date = new Date()): Registration {
  const legalName = blank(input.legalName);
  if (legalName !== null && (legalName.length < 2 || legalName.length > 160)) throw new DomainError('registration.legal_name_invalid');
  const rawTax = blank(input.taxId);
  const registryNumber = blank(input.registryNumber);
  if (registryNumber !== null && registryNumber.length > 40) throw new DomainError('registration.registry_number_invalid');
  const mersis = blank(input.mersisNumber)?.replace(/[\s-]/g, '') ?? null;
  if (mersis !== null && !/^\d{16}$/.test(mersis)) throw new DomainError('registration.mersis_invalid');
  const lei = blank(input.lei)?.toUpperCase().replace(/\s/g, '') ?? null;
  if (lei !== null && !isValidLei(lei)) throw new DomainError('registration.lei_invalid');
  const hub = blank(input.openSupplyHubId)?.toUpperCase() ?? null;
  if (hub !== null && !/^[A-Z0-9]{1,20}$/.test(hub)) throw tooLong();
  const employees = blank(input.employees);
  if (employees !== null && !(BANDS as readonly string[]).includes(employees)) throw new DomainError('registration.employees_invalid');
  const nace = [...new Set((input.naceCodes ?? []).map(normalizeNace))];
  if (nace.length > 10) throw new DomainError('registration.nace_invalid');
  const certs = input.certifications ?? [];
  if (certs.length > 10) throw new DomainError('registration.certification_invalid');
  const certifications = certs.map((c) => {
    const number = c.number.trim();
    const validUntil = blank(c.validUntil);
    if (!(SCHEMES as readonly string[]).includes(c.scheme) || number.length < 1 || number.length > 60 || (validUntil !== null && !realDate(validUntil)))
      throw new DomainError('registration.certification_invalid');
    return Object.freeze({ scheme: c.scheme as CertificationScheme, number, validUntil });
  });
  return Object.freeze({
    companyId,
    legalName,
    taxId: rawTax === null ? null : normalizeTaxId(country, rawTax),
    taxOffice: text(input.taxOffice, 120),
    registryNumber,
    mersisNumber: mersis,
    industryRegistryNumber: text(input.industryRegistryNumber, 120),
    lei,
    registeredAddress: text(input.registeredAddress, 300),
    facilityAddress: text(input.facilityAddress, 300),
    monthlyCapacity: text(input.monthlyCapacity, 120),
    openSupplyHubId: hub,
    employees: employees as EmployeeBand | null,
    naceCodes: Object.freeze(nace),
    certifications: Object.freeze(certifications),
    updatedAt: now,
  });
}

// Field keys first, then `doc:<group>` for every required group with no matching document.
export function missingForSubmit(country: string, reg: Registration | null, documentKinds: readonly DocumentKind[]): string[] {
  const missing: string[] = [];
  if (!reg?.legalName) missing.push('legal_name');
  if (!reg?.taxId) missing.push('tax_id');
  if (!reg?.registryNumber) missing.push('registry_number');
  if (!reg?.registeredAddress) missing.push('registered_address');
  if (!reg?.facilityAddress) missing.push('facility_address');
  if (!reg?.naceCodes.some(isManufacturingNace)) missing.push('nace_manufacturing');
  for (const g of requiredDocuments(country)) if (!g.anyOf.some((k) => documentKinds.includes(k))) missing.push(`doc:${g.key}`);
  return missing;
}

export type ReviewAction = 'submitted' | 'approved' | 'rejected' | 'changes_requested' | 'edited';

export type ReviewEvent = Readonly<{
  id: string;
  companyId: string;
  actorUserId: string;
  action: ReviewAction;
  note: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  createdAt: Date;
}>;

export function assertOwnerCanEdit(c: Company): void {
  if (c.status !== 'draft' && c.status !== 'changes_requested') throw new DomainError('registration.locked');
}

const transition = (c: Company, status: CompanyStatus, actorUserId: string, action: ReviewAction, note: string | null, now: Date) => ({
  company: Object.freeze({ ...c, status }),
  event: Object.freeze({ id: newId(), companyId: c.id, actorUserId, action, note, changes: null, createdAt: now }) as ReviewEvent,
});

export function submitCompany(c: Company, missing: readonly string[], now: Date = new Date()) {
  assertOwnerCanEdit(c);
  if (missing.length > 0) throw new DomainError('registration.incomplete');
  return transition(c, 'submitted', c.ownerUserId, 'submitted', null, now);
}

function assertAdminMay(c: Company, adminUserId: string, from: readonly CompanyStatus[]): void {
  if (c.ownerUserId === adminUserId) throw new DomainError('review.own_company');
  if (!from.includes(c.status)) throw new DomainError('registration.not_submitted');
}

const noteOf = (note: string): string => {
  const n = note.trim();
  if (n.length < 1 || n.length > 1000) throw new DomainError('review.note_invalid');
  return n;
};

export function approveCompany(c: Company, adminUserId: string, now: Date = new Date()) {
  assertAdminMay(c, adminUserId, ['submitted']);
  return transition(c, 'approved', adminUserId, 'approved', null, now);
}

export function rejectCompany(c: Company, adminUserId: string, note: string, now: Date = new Date()) {
  assertAdminMay(c, adminUserId, ['submitted', 'approved']);
  return transition(c, 'rejected', adminUserId, 'rejected', noteOf(note), now);
}

export function requestCompanyChanges(c: Company, adminUserId: string, note: string, now: Date = new Date()) {
  assertAdminMay(c, adminUserId, ['submitted']);
  return transition(c, 'changes_requested', adminUserId, 'changes_requested', noteOf(note), now);
}

// An admin's edit leaves the status alone; only the log records it.
export function editedEvent(c: Company, adminUserId: string, changes: Record<string, [unknown, unknown]>, now: Date = new Date()): ReviewEvent {
  if (c.ownerUserId === adminUserId) throw new DomainError('review.own_company');
  return Object.freeze({ id: newId(), companyId: c.id, actorUserId: adminUserId, action: 'edited', note: null, changes, createdAt: now });
}

// JSON with object keys sorted, so jsonb's key order (by length) doesn't read as a change.
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

export function diffRegistration(before: Registration | null, after: Registration): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after) as (keyof Registration)[]) {
    if (key === 'companyId' || key === 'updatedAt') continue;
    const a = before?.[key] ?? null;
    const b = after[key];
    if (canonical(a) !== canonical(b)) out[key] = [a, b];
  }
  return out;
}
