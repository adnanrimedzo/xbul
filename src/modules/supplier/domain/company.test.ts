import { expect, it } from 'vitest';
import { createCompany } from './company';

it('creates a company with trimmed name, slug and upper-case country', () => {
  const c = createCompany({ name: '  Indigo Mill ', city: 'Istanbul', country: 'tr', ownerUserId: 'u1' });
  expect(c).toMatchObject({ name: 'Indigo Mill', slug: 'indigo-mill', country: 'TR', kind: 'fabric_mill' });
});

it.each([
  [{ name: 'A' }, 'company.name_invalid'],
  [{ country: 'TUR' }, 'company.country_invalid'],
  [{ city: '' }, 'company.city_invalid'],
])('rejects %j', (patch, code) =>
  expect(() => createCompany({ name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', ...patch }))
    .toThrow(expect.objectContaining({ code })));
