import { foldText } from '../fold';
import type { Localized } from './parts';

export type ProductTypeId =
  | 't_shirt' | 'suit' | 'dress' | 'jacket' | 'coat' | 'skirt'
  | 'shorts' | 'jeans' | 'trousers' | 'shirt' | 'knit_top';

export const PRODUCT_TYPES: Readonly<Record<ProductTypeId, { name: Localized; hs: readonly string[] }>> = {
  t_shirt: { name: { en: 'T-shirt', tr: 'Tişört' }, hs: ['6109'] },
  suit: { name: { en: 'Suit', tr: 'Takım elbise' }, hs: ['6203.1', '6204.1'] },
  dress: { name: { en: 'Dress', tr: 'Elbise' }, hs: ['6204.4'] },
  jacket: { name: { en: 'Jacket or blazer', tr: 'Ceket' }, hs: ['6203.3', '6204.3'] },
  coat: { name: { en: 'Coat', tr: 'Mont, kaban' }, hs: ['6201', '6202'] },
  skirt: { name: { en: 'Skirt', tr: 'Etek' }, hs: ['6204.5'] },
  shorts: { name: { en: 'Shorts', tr: 'Şort' }, hs: ['6203.4', '6204.6'] },
  jeans: { name: { en: 'Jeans', tr: 'Kot pantolon' }, hs: ['6203.42', '6204.62'] },
  trousers: { name: { en: 'Trousers', tr: 'Pantolon' }, hs: ['6203.4', '6204.6'] },
  shirt: { name: { en: 'Shirt or blouse', tr: 'Gömlek, bluz' }, hs: ['6205', '6206'] },
  knit_top: { name: { en: 'Sweater or sweatshirt', tr: 'Kazak, sweatshirt' }, hs: ['6110'] },
};

// Order matters: the first match wins.
const GUESSES: readonly [ProductTypeId, RegExp][] = [
  ['t_shirt', /\b(t ?shirts?|tees?|tisort)\b/],
  ['suit', /\b(suits?|takim elbise)\b/],
  ['dress', /\b(dress(es)?|elbise)\b/],
  ['jacket', /\b(jackets?|blazers?|ceket)\b/],
  ['coat', /\b(coats?|parkas?|trench|anoraks?|mont|kaban)\b/],
  ['skirt', /\b(skirts?|etek)\b/],
  ['shorts', /\b(shorts|sort)\b/],
  ['jeans', /\b(jeans?|kot)\b/],
  ['trousers', /\b(trousers?|pants?|chinos?|pantolon)\b/],
  ['shirt', /\b(shirts?|overshirts?|blouses?|gomlek|bluz)\b/],
  ['knit_top', /\b(sweaters?|jumpers?|pullovers?|sweatshirts?|hoodies?|cardigans?|kazak|hirka)\b/],
];

export function guessProductType(name: string): ProductTypeId | null {
  const folded = foldText(name).replace(/-/g, ' ');
  return GUESSES.find(([, re]) => re.test(folded))?.[0] ?? null;
}

export function formatHs(codes: readonly string[]): string {
  return `HS ${codes.join(' / ')}`;
}
