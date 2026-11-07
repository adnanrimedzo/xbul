import { expect, it } from 'vitest';
import { isManufacturingNace, isValidLei, normalizeNace, normalizeTaxId } from './legal-identifiers';

it.each([
  ['TR', '123 456 7890', '1234567890'],
  ['TR', '484-084-7211', '4840847211'],
  ['TR', '10000000146', '10000000146'], // TCKN: a sole proprietor's tax number
  ['DE', 'DE 123-456-789', 'DE123456789'],
  ['DE', '123456789', 'DE123456789'],
  ['GR', '123456789', 'EL123456789'],
  ['GR', 'EL123456789', 'EL123456789'],
  ['NL', 'nl004495445b01', 'NL004495445B01'],
  ['GB', 'GB123456789', 'GB123456789'],
  ['SA', '300000000000003', '300000000000003'],
  ['AE', '100123456700003', '100123456700003'],
  ['US', '12-3456789', '123456789'],
])('normalizeTaxId(%s, %s) → %s', (country, raw, expected) => expect(normalizeTaxId(country, raw)).toBe(expected));

it.each([
  ['TR', '1234567891'], ['TR', '10000000147'], ['TR', '123'], ['FR', '12345'], ['SA', '400000000000003'], ['DE', ''],
])('normalizeTaxId(%s, %s) throws', (country, raw) =>
  expect(() => normalizeTaxId(country, raw)).toThrow(expect.objectContaining({ code: 'registration.tax_id_invalid' })));

it('checks the LEI checksum (ISO 17442, mod 97)', () => {
  expect(isValidLei('5493001KJTIIGC8Y1R12')).toBe(true);
  expect(isValidLei('5493001KJTIIGC8Y1R13')).toBe(false);
});

it.each([
  ['13.20', '13.20'], ['1320', '13.20'], ['13.20.01', '13.20.01'], ['132001', '13.20.01'], ['13', '13'], ['13.2', '13.2'],
])('normalizeNace(%s) → %s', (raw, expected) => expect(normalizeNace(raw)).toBe(expected));

it.each(['abc', '00', '1', '1234567'])('normalizeNace(%s) throws', (raw) =>
  expect(() => normalizeNace(raw)).toThrow(expect.objectContaining({ code: 'registration.nace_invalid' })));

it('manufacturing is NACE section C, divisions 10–33', () => {
  expect(['10.11', '13.20.01', '33'].map(isManufacturingNace)).toEqual([true, true, true]);
  expect(['09.10', '46.41'].map(isManufacturingNace)).toEqual([false, false]);
});
