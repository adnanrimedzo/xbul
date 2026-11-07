import { DomainError } from '@/shared/domain/errors';

const strip = (raw: string): string => raw.replace(/[\s.\-/]/g, '').toUpperCase();

// ISO country → VIES member-state code, for the 27 EU countries (Greece is EL).
export const VIES_MEMBER_STATE: Readonly<Record<string, string>> = Object.fromEntries(
  'AT BE BG CY CZ DE DK EE ES FI FR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' ').map((c) => [c, c]).concat([['GR', 'EL']]),
);

const EU_VAT: Readonly<Record<string, RegExp>> = {
  AT: /^U\d{8}$/, BE: /^[01]\d{9}$/, BG: /^\d{9,10}$/, CY: /^\d{8}[A-Z]$/, CZ: /^\d{8,10}$/, DE: /^\d{9}$/, DK: /^\d{8}$/,
  EE: /^\d{9}$/, GR: /^\d{9}$/, ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/, FI: /^\d{8}$/, FR: /^[A-HJ-NP-Z0-9]{2}\d{9}$/, HR: /^\d{11}$/,
  HU: /^\d{8}$/, IE: /^(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$/, IT: /^\d{11}$/, LT: /^(\d{9}|\d{12})$/, LU: /^\d{8}$/,
  LV: /^\d{11}$/, MT: /^\d{8}$/, NL: /^\d{9}B\d{2}$/, PL: /^\d{10}$/, PT: /^\d{9}$/, RO: /^\d{2,10}$/, SE: /^\d{12}$/,
  SI: /^\d{8}$/, SK: /^\d{10}$/,
};

const digits = (v: string): number[] => [...v].map(Number);

export function isValidVkn(v: string): boolean {
  if (!/^\d{10}$/.test(v)) return false;
  const d = digits(v);
  let s = 0;
  for (let i = 1; i <= 9; i++) {
    const c1 = (d[9 - i]! + i) % 10;
    if (c1 !== 0) s += (c1 * 2 ** i) % 9 || 9;
  }
  return (10 - (s % 10)) % 10 === d[9];
}

export function isValidTckn(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = digits(v);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  return d[9] === d10 && d[10] === (d.slice(0, 10).reduce((a, b) => a + b, 0) % 10);
}

export function isValidLei(v: string): boolean {
  if (!/^[A-Z0-9]{20}$/.test(v)) return false;
  let mod = 0;
  for (const ch of v) for (const n of String(parseInt(ch, 36))) mod = (mod * 10 + Number(n)) % 97;
  return mod === 1;
}

const invalid = () => new DomainError('registration.tax_id_invalid');

export function normalizeTaxId(country: string, raw: string): string {
  const c = country.toUpperCase();
  const v = strip(raw);
  if (c === 'TR') {
    if (isValidVkn(v) || isValidTckn(v)) return v;
    throw invalid();
  }
  const eu = EU_VAT[c];
  if (eu) {
    const prefix = VIES_MEMBER_STATE[c]!;
    const num = v.startsWith(prefix) ? v.slice(prefix.length) : v;
    if (!eu.test(num)) throw invalid();
    return prefix + num;
  }
  if (c === 'GB') {
    const num = v.replace(/^GB/, '');
    if (!/^(\d{9}|\d{12})$/.test(num)) throw invalid();
    return `GB${num}`;
  }
  if (c === 'CH') {
    const num = v.replace(/^CHE/, '').replace(/(MWST|TVA|IVA)$/, '');
    if (!/^\d{9}$/.test(num)) throw invalid();
    return `CHE${num}`;
  }
  const pattern = c === 'SA' ? /^3\d{13}3$/ : c === 'AE' ? /^\d{15}$/ : c === 'IL' || c === 'EG' ? /^\d{9}$/ : /^[A-Z0-9]{5,20}$/;
  if (!pattern.test(v)) throw invalid();
  return v;
}

export function normalizeNace(raw: string): string {
  const d = raw.replace(/\./g, '').trim();
  if (!/^\d+$/.test(d) || ![2, 3, 4, 6].includes(d.length) || Number(d.slice(0, 2)) < 1) throw new DomainError('registration.nace_invalid');
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)].filter(Boolean).join('.');
}

// NACE section C (manufacturing) is divisions 10–33.
export function isManufacturingNace(code: string): boolean {
  const division = Number(code.slice(0, 2));
  return division >= 10 && division <= 33;
}

export function taxIdLabel(country: string): 'vkn' | 'vat' | 'trn' | 'company_number' | 'tax_id' {
  const c = country.toUpperCase();
  if (c === 'TR') return 'vkn';
  if (c in VIES_MEMBER_STATE || c === 'GB' || c === 'CH' || c === 'SA') return 'vat';
  if (c === 'AE') return 'trn';
  if (c === 'IL') return 'company_number';
  return 'tax_id';
}
