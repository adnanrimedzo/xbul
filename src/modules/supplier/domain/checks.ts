import { foldText } from '@/shared/domain/fold';
import { isManufacturingNace, isValidVkn, normalizeTaxId } from './legal-identifiers';

export type CheckSource = 'tax_id_format' | 'mersis_matches_tax_id' | 'nace_manufacturing' | 'email_domain' | 'eu_vies' | 'gleif';
export type CheckOutcome = 'pass' | 'fail' | 'unknown';
export type CheckResult = Readonly<{ source: CheckSource; outcome: CheckOutcome; summary: string; checkedAt: Date }>;
export type CheckSubject = Readonly<{
  country: string;
  legalName: string | null;
  taxId: string | null;
  mersisNumber: string | null;
  lei: string | null;
  naceCodes: readonly string[];
  website: string | null;
  ownerEmail: string | null;
}>;

export const CHECK_ORDER: readonly CheckSource[] = ['tax_id_format', 'mersis_matches_tax_id', 'nace_manufacturing', 'email_domain', 'eu_vies', 'gleif'];

const FREE_MAIL = new Set('gmail.com hotmail.com outlook.com yahoo.com icloud.com yandex.com yandex.com.tr mail.ru proton.me'.split(' '));

function taxIdFormat(s: CheckSubject): [CheckOutcome, string] {
  if (!s.taxId) return ['unknown', 'No tax number entered'];
  try {
    const id = normalizeTaxId(s.country, s.taxId);
    if (s.country.toUpperCase() !== 'TR') return ['pass', 'Tax number format valid'];
    return ['pass', id.length === 10 ? 'VKN checksum valid' : 'TCKN (sole proprietor) checksum valid'];
  } catch {
    return ['fail', 'Tax number is not valid for this country'];
  }
}

function mersisMatches(s: CheckSubject): [CheckOutcome, string] {
  if (!s.mersisNumber) return ['unknown', 'No MERSİS number entered'];
  if (!s.taxId || !isValidVkn(s.taxId)) return ['unknown', 'MERSİS is compared only with a 10-digit VKN'];
  // Digits 2–11 of the MERSİS number are the VKN. Only third parties document this, so a mismatch is never a fail.
  return s.mersisNumber.slice(1, 11) === s.taxId
    ? ['pass', 'MERSİS number contains the VKN']
    : ['unknown', 'MERSİS number does not follow the usual VKN pattern'];
}

function naceManufacturing(s: CheckSubject): [CheckOutcome, string] {
  if (s.naceCodes.length === 0) return ['unknown', 'No activity codes entered'];
  return s.naceCodes.some(isManufacturingNace)
    ? ['pass', 'At least one activity code is in manufacturing (10–33)']
    : ['fail', 'No activity code is in manufacturing (10–33)'];
}

function emailDomain(s: CheckSubject): [CheckOutcome, string] {
  if (!s.website || !s.ownerEmail) return ['unknown', 'No website or sign-in email to compare'];
  let site: string;
  try {
    site = new URL(/^https?:\/\//i.test(s.website) ? s.website : `https://${s.website}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return ['unknown', 'Website address could not be read'];
  }
  const mail = s.ownerEmail.slice(s.ownerEmail.lastIndexOf('@') + 1).toLowerCase();
  if (FREE_MAIL.has(mail)) return ['unknown', 'Sign-in email is a free-mail address'];
  return mail === site || mail.endsWith(`.${site}`) || site.endsWith(`.${mail}`)
    ? ['pass', 'Sign-in email domain matches the website']
    : ['unknown', 'Sign-in email domain differs from the website'];
}

export function localChecks(s: CheckSubject, now: Date = new Date()): CheckResult[] {
  const run: Record<string, (s: CheckSubject) => [CheckOutcome, string]> = {
    tax_id_format: taxIdFormat,
    mersis_matches_tax_id: mersisMatches,
    nace_manufacturing: naceManufacturing,
    email_domain: emailDomain,
  };
  return CHECK_ORDER.filter((source) => source in run).map((source) => {
    const [outcome, summary] = run[source]!(s);
    return { source, outcome, summary, checkedAt: now };
  });
}

const LEGAL_FORM_WORDS = new Set(
  `anonim sirketi sirket as ltd limited sti san sanayi sanayii tic ticaret ve ith ihr ithalat ihracat paz pazarlama
gmbh mbh ag kg co sa sas sarl srl spa bv nv plc llc inc corp company the and fze fzco fzc wll ltda sp zoo oy ab kft doo`.split(/\s+/),
);

const tokens = (name: string): Set<string> =>
  new Set(foldText(name).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1 && !LEGAL_FORM_WORDS.has(t)));

export function legalNameMatches(a: string, b: string): boolean {
  const [x, y] = [tokens(a), tokens(b)];
  const [small, large] = x.size <= y.size ? [x, y] : [y, x];
  if (small.size === 0 || ![...small].every((t) => large.has(t))) return false;
  return small.size === large.size || small.size >= 2;
}
