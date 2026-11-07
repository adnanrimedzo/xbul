import type { Localized } from './parts';

export type FibreCode =
  | 'CO' | 'LI' | 'HA' | 'WO' | 'WS' | 'SE' | 'VI' | 'CMD'
  | 'CLY' | 'CUP' | 'CA' | 'PES' | 'PA' | 'PAN' | 'PP' | 'EL';

type Fibre = { name: Localized; genericName: string; latin: string | null; group: 'natural' | 'man_made' };

const natural = (en: string, tr: string, genericName: string, latin: string): Fibre =>
  ({ name: { en, tr }, genericName, latin, group: 'natural' });
const manMade = (en: string, tr: string, genericName: string): Fibre =>
  ({ name: { en, tr }, genericName, latin: null, group: 'man_made' });

export const FIBRES: Readonly<Record<FibreCode, Fibre>> = {
  CO: natural('Cotton', 'Pamuk', 'cotton', 'Gossypium spp.'),
  LI: natural('Linen', 'Keten', 'flax', 'Linum usitatissimum'),
  HA: natural('Hemp', 'Kenevir', 'hemp', 'Cannabis sativa'),
  WO: natural('Wool', 'Yün', 'wool', 'Ovis aries'),
  WS: natural('Cashmere', 'Kaşmir', 'cashmere', 'Capra hircus'),
  SE: natural('Silk', 'İpek', 'silk', 'Bombyx mori'),
  VI: manMade('Viscose', 'Viskon', 'viscose'),
  CMD: manMade('Modal', 'Modal', 'modal'),
  CLY: manMade('Lyocell', 'Lyosel', 'lyocell'),
  CUP: manMade('Cupro', 'Kupro', 'cupro'),
  CA: manMade('Acetate', 'Asetat', 'acetate'),
  PES: manMade('Polyester', 'Polyester', 'polyester'),
  PA: manMade('Polyamide (nylon)', 'Poliamid (naylon)', 'polyamide'),
  PAN: manMade('Acrylic', 'Akrilik', 'acrylic'),
  PP: manMade('Polypropylene', 'Polipropilen', 'polypropylene'),
  EL: manMade('Elastane', 'Elastan', 'elastane'),
};

// PE is deliberately not an alias: it means polyethylene.
const ALIASES: Readonly<Record<string, FibreCode>> = { EA: 'EL', PL: 'PES', NY: 'PA' };

export function normalizeFibreCode(raw: string): FibreCode | null {
  const code = raw.trim().toUpperCase();
  if (code in FIBRES) return code as FibreCode;
  return ALIASES[code] ?? null;
}
