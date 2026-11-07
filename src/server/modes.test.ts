import { expect, it } from 'vitest';
import { availableModes, modeHome, onboardingRedirect, resolveMode } from './modes';

it('every signed-in user can search and register; only admins get admin', () => {
  expect(availableModes({ isAdmin: false })).toEqual(['search', 'manufacturer']);
  expect(availableModes({ isAdmin: true })).toEqual(['search', 'manufacturer', 'admin']);
});

it.each([
  [{ isAdmin: false, hasCompany: true }, undefined, { mode: 'manufacturer', chosen: false }],
  [{ isAdmin: true, hasCompany: false }, undefined, { mode: 'admin', chosen: false }],
  [{ isAdmin: false, hasCompany: false }, undefined, { mode: 'search', chosen: false }],
  [{ isAdmin: true, hasCompany: true }, 'search', { mode: 'search', chosen: true }],
  [{ isAdmin: false, hasCompany: true }, 'admin', { mode: 'manufacturer', chosen: false }], // forged: not held, ignored
  [{ isAdmin: false, hasCompany: false }, 'garbage', { mode: 'search', chosen: false }],
] as const)('resolveMode(%j, %s)', (v, cookie, expected) => expect(resolveMode(v, cookie)).toEqual(expected));

it('each mode has a home', () => {
  expect(modeHome('search', null)).toBe('/');
  expect(modeHome('manufacturer', 'indigo-mill')).toBe('/m/indigo-mill');
  expect(modeHome('manufacturer', null)).toBe('/onboarding');
  expect(modeHome('admin', null)).toBe('/admin/claims');
});

it.each([
  [{ company: { slug: 'indigo-mill' }, mode: 'manufacturer', modeChosen: false, isAdmin: false }, '/add'],
  [{ company: { slug: 'indigo-mill' }, mode: 'search', modeChosen: true, isAdmin: false }, '/'],
  [{ company: null, mode: 'search', modeChosen: true, isAdmin: false }, '/'],
  [{ company: null, mode: 'admin', modeChosen: false, isAdmin: true }, '/admin/claims'], // an admin is here to review, unless they pick manufacturer
  [{ company: null, mode: 'manufacturer', modeChosen: true, isAdmin: true }, null], // an admin registering a company
  [{ company: null, mode: 'search', modeChosen: false, isAdmin: false }, null], // a new user sees the choice and the form
] as const)('onboardingRedirect(%j) is %s', (v, expected) => expect(onboardingRedirect(v)).toBe(expected));
