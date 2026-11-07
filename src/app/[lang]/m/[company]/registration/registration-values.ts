import { requiredDocuments, type Registration, type RegistrationInput } from '@/modules/supplier';
import type { REGISTRATION } from './messages';

// The registration form's fields, flat. Shared by the owner's registration page and the admin's edit form.
// Pages fill the form from these, and a failed save echoes them back.
export type RegistrationValues = Record<string, string>;

const TEXT_FIELDS = [
  'legalName', 'taxId', 'taxOffice', 'registryNumber', 'mersisNumber', 'industryRegistryNumber', 'lei',
  'registeredAddress', 'facilityAddress', 'monthlyCapacity', 'openSupplyHubId', 'employees',
] as const;
const CERT_ROWS = [0, 1, 2] as const;
const FIELDS = [...TEXT_FIELDS, 'naceCodes', ...CERT_ROWS.flatMap((i) => [`cert${i}Scheme`, `cert${i}Number`, `cert${i}ValidUntil`])];

export function readRegistrationForm(form: FormData): RegistrationValues {
  return Object.fromEntries(FIELDS.map((name) => {
    const value = form.get(name);
    return [name, typeof value === 'string' ? value.trim() : ''];
  }));
}

export function toRegistrationInput(v: RegistrationValues): RegistrationInput {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, v[name]])),
    naceCodes: v.naceCodes!.split(/[,;\s]+/).filter(Boolean),
    certifications: CERT_ROWS.map((i) => ({ scheme: v[`cert${i}Scheme`]!, number: v[`cert${i}Number`]!, validUntil: v[`cert${i}ValidUntil`] }))
      .filter((c) => c.scheme || c.number || c.validUntil), // a blank row is no certificate
  };
}

// A saved registration as the form's fields.
export function registrationFormValues(r: Registration | null): RegistrationValues {
  if (!r) return {};
  const values: RegistrationValues = { naceCodes: r.naceCodes.join(', ') };
  for (const key of TEXT_FIELDS) values[key] = r[key] ?? '';
  r.certifications.forEach((c, i) => Object.assign(values, { [`cert${i}Scheme`]: c.scheme, [`cert${i}Number`]: c.number, [`cert${i}ValidUntil`]: c.validUntil ?? '' }));
  return values;
}

// The checklist sentence for one missingForSubmit key.
export function missingSentence(t: (typeof REGISTRATION)['en'], country: string, key: string): string {
  const group = requiredDocuments(country).find((g) => `doc:${g.key}` === key);
  return group ? t.uploadOneOf(group.anyOf.map((k) => t.kinds[k])) : t.missing[key as keyof typeof t.missing];
}
