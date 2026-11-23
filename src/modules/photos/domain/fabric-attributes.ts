import { GSM_PER_OZ, isDenim, type Construction, type DyeMethod, type FabricSpec, type FibreCode, type Pattern } from '@/shared/domain/taxonomy';
import type { PhotoFabric, TwillDirection, TwillRatio } from './photo-tags';

// Fabric attributes as a model sees them in a photo (each with its own confidence) and as suppliers declare them.
export type AttrKey = 'construction' | 'pattern' | 'twillRatio' | 'twillDirection' | 'denim' | 'dye';
export const ATTR_KEYS: readonly AttrKey[] = ['construction', 'pattern', 'twillRatio', 'twillDirection', 'denim', 'dye'];

export type Attributes = Partial<{
  construction: Construction;
  pattern: Pattern;
  twillRatio: TwillRatio;
  twillDirection: TwillDirection;
  denim: boolean;
  dye: DyeMethod;
}>;

export type Seen<T> = Readonly<{ value: T; confidence: number }> | null;
export type SeenAttributes = Readonly<{ [K in AttrKey]: Seen<NonNullable<Attributes[K]>> }>;
export type ViewKind = 'close_up' | 'product' | 'worn';

export const NOTHING_SEEN: SeenAttributes = Object.freeze({ construction: null, pattern: null, twillRatio: null, twillDirection: null, denim: null, dye: null });

// ponytail: fixed bars, calibrated on staging (docs/runbook.md). The weave is hard to resolve unless the photo is a close-up,
// so pattern and twill need a much higher confidence on product or worn shots.
export const ATTR_MIN_CONFIDENCE = 0.6;
export const WEAVE_MIN_CONFIDENCE_FAR = 0.85;
const WEAVE: readonly AttrKey[] = ['pattern', 'twillRatio', 'twillDirection'];

export function confidentAttributes(seen: SeenAttributes, viewKind: ViewKind): Attributes {
  const out: Record<string, unknown> = {};
  for (const k of ATTR_KEYS) {
    const s = seen[k];
    const bar = viewKind !== 'close_up' && WEAVE.includes(k) ? WEAVE_MIN_CONFIDENCE_FAR : ATTR_MIN_CONFIDENCE;
    if (s && s.confidence >= bar) out[k] = s.value;
  }
  // A twill detail without the twill pattern itself is noise.
  if (out.pattern !== 'twill') {
    delete out.twillRatio;
    delete out.twillDirection;
  }
  return out as Attributes;
}

export function photoFabricAttributes(f: PhotoFabric): Attributes {
  const out: Record<string, unknown> = {};
  for (const k of ATTR_KEYS) if (f[k] !== null) out[k] = f[k];
  return out as Attributes;
}

export function specAttributes(s: FabricSpec): Attributes {
  return {
    construction: s.construction,
    pattern: s.pattern,
    ...(s.twill && { twillRatio: s.twill.ratio, twillDirection: s.twill.direction }),
    denim: isDenim(s),
    ...(s.dye && { dye: s.dye }),
  };
}

// The supplier's own photo tags first; the linked article's spec fills what the tags leave open.
export function supplierAttributes(photo: PhotoFabric | null, spec: FabricSpec | null): Attributes {
  return { ...(spec ? specAttributes(spec) : {}), ...(photo ? photoFabricAttributes(photo) : {}) };
}

// Attributes missing on either side are neutral, never a conflict. Twill details only count when both sides are twill.
export function compareAttributes(buyer: Attributes, supplier: Attributes): { agree: AttrKey[]; conflict: AttrKey[] } {
  const agree: AttrKey[] = [];
  const conflict: AttrKey[] = [];
  const bothTwill = buyer.pattern === 'twill' && supplier.pattern === 'twill';
  for (const k of ATTR_KEYS) {
    if ((k === 'twillRatio' || k === 'twillDirection') && !bothTwill) continue;
    const b = buyer[k];
    const s = supplier[k];
    if (b === undefined || s === undefined) continue;
    (b === s ? agree : conflict).push(k);
  }
  return { agree, conflict };
}

export type FabricFilters = Readonly<{ fibre: FibreCode | null; gsmMin: number | null; gsmMax: number | null }>;
export const NO_FILTERS: FabricFilters = Object.freeze({ fibre: null, gsmMin: null, gsmMax: null });

export const hasFilters = (f: FabricFilters) => f.fibre !== null || f.gsmMin !== null || f.gsmMax !== null;
export const ozToGsm = (oz: number) => Math.round(oz * GSM_PER_OZ);

// null when there is no spec to judge: photos without a linked article pass the filters but rank after those that matched.
export function matchesFilters(spec: FabricSpec | null, f: FabricFilters): boolean | null {
  if (!hasFilters(f)) return true;
  if (!spec) return null;
  if (f.fibre && !spec.fibres.some((x) => x.code === f.fibre)) return false;
  if (f.gsmMin !== null && spec.weightGsm < f.gsmMin) return false;
  if (f.gsmMax !== null && spec.weightGsm > f.gsmMax) return false;
  return true;
}
