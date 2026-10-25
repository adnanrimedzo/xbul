import { expect, it } from 'vitest';
import { slugify } from './slug';

it.each([
  ['ÇORLU DENIM WORKS', 'corlu-denim-works'],
  ['  Işık Tekstil A.Ş. ', 'isik-tekstil-a-s'],
  ['60219/1', '60219-1'],
  ['Ğüşöç İ', 'gusoc-i'],
  ['///', ''],
])('slugify(%j) → %j', (input, expected) => expect(slugify(input)).toBe(expected));
