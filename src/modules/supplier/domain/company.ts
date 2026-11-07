import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { slugify } from '@/shared/domain/slug';
import type { CompanyStatus } from './registration';

export type { CompanyStatus };

export type CompanyContact = Readonly<{ email: string | null; phone: string | null; website: string | null }>;
export type ContactInput = { email?: string | null; phone?: string | null; website?: string | null };

export type CompanyKind = 'fabric_mill' | 'garment_maker';

// A company is either a fabric mill or a garment maker, and its claims count for that side only.
// Plain strings, not the claims module's type: a domain file may not import another module.
const SCOPE_OF: Record<CompanyKind, 'fabric' | 'garment'> = { fabric_mill: 'fabric', garment_maker: 'garment' };
export const claimScopeOf = (kind: CompanyKind): 'fabric' | 'garment' => SCOPE_OF[kind];

export type Company = Readonly<{
  id: string;
  slug: string;
  name: string;
  kind: CompanyKind;
  city: string;
  country: string;
  ownerUserId: string;
  contact: CompanyContact;
  status: CompanyStatus;
  createdAt: Date;
}>;

const blank = (v: string | null | undefined): string | null => v?.trim() || null;

// At least one way to reach the supplier. The platform relays nothing, so these are the only channel.
export function normalizeContact(input: ContactInput): CompanyContact {
  const email = blank(input.email)?.toLowerCase() ?? null;
  if (email !== null && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new DomainError('company.email_invalid');
  const phone = blank(input.phone);
  if (phone !== null && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) throw new DomainError('company.phone_invalid');
  const raw = blank(input.website);
  let website: string | null = null;
  if (raw !== null) {
    // Only a web address is a website: `javascript:` and `ftp://` are refused, a bare `taypa.com` gets https.
    const url = raw.includes('://') || /^[a-z]+:/.test(raw) ? raw : `https://${raw}`;
    if (raw.length > 2048 || !URL.canParse(url)) throw new DomainError('company.website_invalid');
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new DomainError('company.website_invalid');
    website = parsed.href;
  }
  if (email === null && phone === null && website === null) throw new DomainError('company.contact_required');
  return Object.freeze({ email, phone, website });
}

export function createCompany(
  input: { name: string; city: string; country: string; ownerUserId: string; contact: ContactInput; kind: CompanyKind },
  now: Date = new Date(),
): Company {
  const name = input.name.trim();
  const slug = slugify(name);
  if (name.length < 2 || name.length > 80 || !slug) throw new DomainError('company.name_invalid');
  const city = input.city.trim();
  if (city.length < 1 || city.length > 60) throw new DomainError('company.city_invalid');
  const country = input.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new DomainError('company.country_invalid');
  if (!Object.hasOwn(SCOPE_OF, input.kind)) throw new DomainError('company.kind_invalid');
  const contact = normalizeContact(input.contact);
  return Object.freeze({ id: newId(), slug, name, kind: input.kind, city, country, ownerUserId: input.ownerUserId, contact, status: 'draft', createdAt: now });
}
