import { expect, it } from 'vitest';
import { FIBRES, PARTS, PRODUCT_TYPES, formatHs, guessProductType, normalizeFibreCode } from './index';

it('exactly one part is the full product', () => expect(PARTS.filter((p) => p.full).map((p) => p.id)).toEqual(['garment']));
it.each([['co', 'CO'], ['EA', 'EL'], ['pl', 'PES'], ['NY', 'PA'], ['PE', null], ['XX', null]])('normalizeFibreCode(%s) → %s', (raw, code) =>
  expect(normalizeFibreCode(raw)).toBe(code));
it('natural fibres carry their Latin names', () => expect(FIBRES.CO.latin).toBe('Gossypium spp.'));
it.each([
  ['Cropped Denim Blazer', 'jacket'], ['Printed Denim Jacket', 'jacket'], ['Trucker Jacket', 'jacket'], ['Skinny JEANS', 'jeans'],
  ['Kot Pantolon', 'jeans'], ['Denim Shorts', 'shorts'], ['Basic T-Shirt', 't_shirt'], ['Shirt Dress', 'dress'], ['Oversize Sweatshirt', 'knit_top'],
  ['Takım Elbise', 'suit'], ['TİŞÖRT', 't_shirt'], ['Linen Overshirt', 'shirt'], ['Wide Leg Trousers', 'trousers'], ['Leather Belt', null],
])('guessProductType(%s) → %s', (name, id) => expect(guessProductType(name)).toBe(id));
it('formats HS codes', () => expect(formatHs(PRODUCT_TYPES.jeans.hs)).toBe('HS 6203.42 / 6204.62'));
