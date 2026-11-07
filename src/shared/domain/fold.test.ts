import { expect, it } from 'vitest';
import { foldText } from './fold';

it.each([['TİŞÖRT', 'tisort'], ['KOÇ', 'koc'], ['Işık', 'isik']])('foldText(%s) → %s', (raw, out) =>
  expect(foldText(raw)).toBe(out));
