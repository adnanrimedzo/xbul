import { expect, it } from 'vitest';
import { claimScopeOf, createCompany, normalizeContact } from './company';

const contact = { email: 'sales@x.test' };
const kind = 'fabric_mill' as const;

it('creates a company with trimmed name, slug and upper-case country', () => {
  const c = createCompany({ name: '  Indigo Mill ', city: 'Istanbul', country: 'tr', ownerUserId: 'u1', contact, kind });
  expect(c).toMatchObject({ name: 'Indigo Mill', slug: 'indigo-mill', country: 'TR', kind: 'fabric_mill' });
});

it('keeps the normalized contact on the company', () => {
  const c = createCompany({ name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'Sales@X.test', website: 'x.test' }, kind });
  expect(c.contact).toEqual({ email: 'sales@x.test', phone: null, website: 'https://x.test/' });
});

it.each([
  [{ name: 'A' }, 'company.name_invalid'],
  [{ country: 'TUR' }, 'company.country_invalid'],
  [{ city: '' }, 'company.city_invalid'],
  [{ contact: {} }, 'company.contact_required'],
])('rejects %j', (patch, code) =>
  expect(() => createCompany({ name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact, kind, ...patch }))
    .toThrow(expect.objectContaining({ code })));

it('rejects an unknown kind', () =>
  expect(() => createCompany({ name: 'Taypa', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'a@b.test' }, kind: 'wizard' as never }))
    .toThrow(expect.objectContaining({ code: 'company.kind_invalid' })));

it.each([['fabric_mill', 'fabric'], ['garment_maker', 'garment']] as const)('%s claims %s', (k, scope) => expect(claimScopeOf(k)).toBe(scope));

it('needs at least one way to reach the supplier', () => {
  expect(() => normalizeContact({})).toThrow(expect.objectContaining({ code: 'company.contact_required' }));
  expect(() => normalizeContact({ email: ' ', phone: '', website: null })).toThrow(expect.objectContaining({ code: 'company.contact_required' }));
});

it('normalizes contact details', () => {
  expect(normalizeContact({ email: ' Sales@Taypa.TEST ', phone: ' +90 (212) 555-0100 ', website: 'taypa.com' }))
    .toEqual({ email: 'sales@taypa.test', phone: '+90 (212) 555-0100', website: 'https://taypa.com/' });
});

it.each([
  [{ email: 'not-an-email' }, 'company.email_invalid'],
  [{ email: `${'a'.repeat(250)}@x.test` }, 'company.email_invalid'],
  [{ phone: 'call me' }, 'company.phone_invalid'],
  [{ website: 'javascript:alert(1)' }, 'company.website_invalid'],
  [{ website: 'ftp://taypa.com' }, 'company.website_invalid'],
  [{ website: `https://x.test/${'a'.repeat(2050)}` }, 'company.website_invalid'],
])('rejects %j', (contact, code) => expect(() => normalizeContact(contact)).toThrow(expect.objectContaining({ code })));
