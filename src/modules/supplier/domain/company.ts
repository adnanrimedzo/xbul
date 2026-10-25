import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { slugify } from '@/shared/domain/slug';

export type Company = Readonly<{
  id: string;
  slug: string;
  name: string;
  kind: 'fabric_mill';
  city: string;
  country: string;
  ownerUserId: string;
  createdAt: Date;
}>;

export function createCompany(
  input: { name: string; city: string; country: string; ownerUserId: string },
  now: Date = new Date(),
): Company {
  const name = input.name.trim();
  const slug = slugify(name);
  if (name.length < 2 || name.length > 80 || !slug) throw new DomainError('company.name_invalid');
  const city = input.city.trim();
  if (city.length < 1 || city.length > 60) throw new DomainError('company.city_invalid');
  const country = input.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new DomainError('company.country_invalid');
  return Object.freeze({ id: newId(), slug, name, kind: 'fabric_mill', city, country, ownerUserId: input.ownerUserId, createdAt: now });
}
