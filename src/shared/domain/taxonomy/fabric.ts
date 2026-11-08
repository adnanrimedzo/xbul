import { DomainError } from '@/shared/domain/errors';
import { FIBRES, normalizeFibreCode, type FibreCode } from './fibres';
import type { Localized } from './parts';
import { formatHs } from './product-types';

export const GSM_PER_OZ = 33.906;

const L = (en: string, tr: string): Localized => ({ en, tr });

export const CONSTRUCTIONS = { woven: L('Woven', 'Dokuma'), knitted: L('Knitted', 'Örme'), nonwoven: L('Nonwoven', 'Dokusuz') } as const;
export type Construction = keyof typeof CONSTRUCTIONS;

const OTHER = L('Other', 'Diğer');
export const PATTERNS = {
  plain: L('Plain weave', 'Bezayağı'),
  twill: L('Twill', 'Dimi'),
  satin: L('Satin', 'Saten'),
  dobby: L('Dobby', 'Armürlü'),
  jacquard: L('Jacquard', 'Jakarlı'),
  single_jersey: L('Single jersey', 'Süprem'),
  interlock: L('Interlock', 'İnterlok'),
  rib: L('Rib', 'Ribana'),
  pique: L('Piqué', 'Lakost'),
  fleece: L('Fleece (3-thread)', 'Üç iplik'),
  french_terry: L('French terry (2-thread)', 'İki iplik'),
  jacquard_knit: L('Knit jacquard', 'Örme jakar'),
  other: OTHER,
} as const;
export type Pattern = keyof typeof PATTERNS;

export const PATTERNS_BY_CONSTRUCTION: Readonly<Record<Construction, readonly Pattern[]>> = {
  woven: ['plain', 'twill', 'satin', 'dobby', 'jacquard', 'other'],
  knitted: ['single_jersey', 'interlock', 'rib', 'pique', 'fleece', 'french_terry', 'jacquard_knit', 'other'],
  nonwoven: ['other'],
};

export const TWILL_RATIOS = ['2/1', '3/1', '2/2'] as const;
export const TWILL_DIRECTIONS = {
  rht: L('right-hand twill (RHT)', 'sağ dimi (RHT)'),
  lht: L('left-hand twill (LHT)', 'sol dimi (LHT)'),
  broken: L('broken twill', 'kırık dimi'),
} as const;

export const DYES = {
  rope: L('Rope-dyed', 'Halat boyama'),
  slasher: L('Slasher-dyed', 'Slasher boyama'),
  yarn_dyed: L('Yarn-dyed', 'İplik boyalı'),
  piece_dyed: L('Piece-dyed', 'Parça boyalı'),
  garment_dyed: L('Garment-dyed', 'Konfeksiyon boyalı'),
  undyed: L('Undyed (greige)', 'Ham'),
} as const;
export type DyeMethod = keyof typeof DYES;

export const FINISHES = {
  sanforized: L('Sanforized', 'Sanforlu'),
  mercerized: L('Mercerized', 'Merserize'),
  coated: L('Coated', 'Kaplamalı'),
  brushed: L('Brushed', 'Şardonlu'),
  water_repellent: L('Water-repellent', 'Su itici'),
} as const;
export type Finish = keyof typeof FINISHES;

type TwillRatio = (typeof TWILL_RATIOS)[number];
type TwillDirection = keyof typeof TWILL_DIRECTIONS;

export type FabricSpec = Readonly<{
  construction: Construction;
  pattern: Pattern;
  twill: { ratio: TwillRatio; direction: TwillDirection } | null;
  fibres: readonly { code: FibreCode; percent: number }[];
  weightGsm: number;
  widthCm: number | null;
  dye: DyeMethod | null;
  finishes: readonly Finish[];
}>;

export type FabricSpecInput = {
  construction?: string;
  pattern?: string;
  twillRatio?: string;
  twillDirection?: string;
  fibres?: { code: string; percent: string | number }[];
  weight?: string | number;
  weightUnit?: string;
  widthCm?: string | number;
  dye?: string;
  finishes?: string[];
};

const blank = (v: string | number | undefined): string => String(v ?? '').trim();
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
// Blank counts as absent; a decimal comma is accepted.
const num = (v: string | number | undefined): number => (blank(v) === '' ? NaN : Number(blank(v).replace(',', '.')));

export function normalizeFabricSpec(input: FabricSpecInput): FabricSpec {
  const construction = blank(input.construction);
  if (!has(CONSTRUCTIONS, construction)) throw new DomainError('fabric.construction_invalid');
  const c = construction as Construction;

  const pattern = blank(input.pattern);
  if (!(PATTERNS_BY_CONSTRUCTION[c] as readonly string[]).includes(pattern)) throw new DomainError('fabric.pattern_invalid');

  const ratio = blank(input.twillRatio);
  const direction = blank(input.twillDirection);
  let twill: FabricSpec['twill'] = null;
  if (pattern === 'twill') {
    if (!(TWILL_RATIOS as readonly string[]).includes(ratio) || !has(TWILL_DIRECTIONS, direction)) throw new DomainError('fabric.twill_invalid');
    twill = { ratio: ratio as TwillRatio, direction: direction as TwillDirection };
  } else if (ratio || direction) throw new DomainError('fabric.twill_invalid');

  const rows = input.fibres ?? [];
  if (rows.length < 1 || rows.length > 4) throw new DomainError('fabric.fibre_invalid');
  const fibres = rows.map((r) => {
    const code = normalizeFibreCode(r.code);
    const percent = num(r.percent);
    if (!code || !Number.isInteger(percent) || percent < 1 || percent > 100) throw new DomainError('fabric.fibre_invalid');
    return { code, percent };
  });
  if (new Set(fibres.map((f) => f.code)).size !== fibres.length) throw new DomainError('fabric.fibre_invalid');
  if (fibres.reduce((n, f) => n + f.percent, 0) !== 100) throw new DomainError('fabric.composition_total');

  const unit = blank(input.weightUnit) || 'gsm';
  const w = num(input.weight);
  const weightGsm = unit === 'oz' ? Math.round(w * GSM_PER_OZ) : Math.round(w);
  if ((unit !== 'gsm' && unit !== 'oz') || !(weightGsm >= 20 && weightGsm <= 1500)) throw new DomainError('fabric.weight_invalid');

  const widthCm = blank(input.widthCm) === '' ? null : num(input.widthCm);
  if (widthCm !== null && (!Number.isInteger(widthCm) || widthCm < 30 || widthCm > 400)) throw new DomainError('fabric.width_invalid');

  const dye = blank(input.dye);
  if (dye && !has(DYES, dye)) throw new DomainError('fabric.dye_invalid');

  const finishes = [...new Set((input.finishes ?? []).map(blank).filter(Boolean))];
  if (!finishes.every((f) => has(FINISHES, f))) throw new DomainError('fabric.finish_invalid');

  return Object.freeze({
    construction: c, pattern: pattern as Pattern, twill, fibres, weightGsm, widthCm,
    dye: (dye || null) as DyeMethod | null, finishes: finishes as Finish[],
  });
}

// Spec §9.3: a warp-faced 3- or 4-thread twill with a dyed warp.
export function isDenim(s: FabricSpec): boolean {
  return s.construction === 'woven' && s.pattern === 'twill' && s.twill !== null && s.twill.ratio !== '2/2'
    && (s.dye === 'rope' || s.dye === 'slasher');
}

// Spec §9.4: Chapter 52 cotton wovens only.
export function fabricHsCode(s: FabricSpec): string | null {
  if (s.construction !== 'woven') return null;
  const share = (pred: (code: FibreCode) => boolean) => s.fibres.filter((f) => pred(f.code)).reduce((n, f) => n + f.percent, 0);
  const cotton = share((c) => c === 'CO');
  if (s.fibres.some((f) => f.code !== 'CO' && f.percent >= cotton)) return null;
  const light = s.weightGsm <= 200;
  const denim = isDenim(s);
  if (cotton >= 85) return light ? '5208' : denim ? '5209.42' : '5209';
  if (share((c) => FIBRES[c].group === 'man_made') > share((c) => c !== 'CO' && FIBRES[c].group === 'natural')) {
    return light ? '5210' : denim ? '5211.42' : '5211';
  }
  return '5212';
}

export function describeFabric(s: FabricSpec, lang: 'en' | 'tr'): string[] {
  const nf = (n: number) => n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 });
  const pct = (n: number) => (lang === 'tr' ? `%${n}` : `${n}%`);
  const form = s.twill ? `${s.twill.ratio} ${TWILL_DIRECTIONS[s.twill.direction][lang]}` : PATTERNS[s.pattern][lang];
  const hs = fabricHsCode(s);
  return [
    `${CONSTRUCTIONS[s.construction][lang]} · ${form}`,
    ...(isDenim(s) ? ['Denim'] : []),
    s.fibres.map((f) => {
      const { name, latin } = FIBRES[f.code];
      return `${pct(f.percent)} ${name[lang]} (${latin ? `${f.code}, ${latin}` : f.code})`;
    }).join(' · '),
    `${s.weightGsm} g/m² (${nf(s.weightGsm / GSM_PER_OZ)} oz/yd²)`,
    ...(s.widthCm === null ? [] : [lang === 'tr' ? `${s.widthCm} cm en` : `${s.widthCm} cm wide`]),
    ...(s.dye ? [DYES[s.dye][lang]] : []),
    ...s.finishes.map((f) => FINISHES[f][lang]),
    ...(hs ? [formatHs([hs])] : []),
  ];
}
