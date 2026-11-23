import { z } from 'zod';
import { ozToGsm, type Attributes, type FabricFilters } from '@/modules/photos';
import { CONSTRUCTIONS, DYES, FIBRES, PATTERNS, PATTERNS_BY_CONSTRUCTION, TWILL_DIRECTIONS, TWILL_RATIOS, type FibreCode } from '@/shared/domain/taxonomy';

// The results page's Refine form is a plain GET form: corrections and filters live in the URL, so they work without
// JavaScript, survive a reload and cost no AI call. A field left out keeps what the photo showed; "any" clears it.
export type RefineParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
const keys = (o: object) => Object.keys(o);
const num = z.coerce.number().positive().max(2000);

export function refine(detected: Attributes, params: RefineParams): { attributes: Attributes; filters: FabricFilters; changed: boolean } {
  const a: Record<string, unknown> = { ...detected };
  let changed = false;
  const set = (key: keyof Attributes, allowed: readonly string[], map: (v: string) => unknown = (v) => v) => {
    const v = one(params[key]);
    if (!v) return;
    if (v === 'any') delete a[key];
    else if (allowed.includes(v)) a[key] = map(v);
    else return; // a malformed value is ignored, not an error
    changed = true;
  };
  set('construction', keys(CONSTRUCTIONS));
  set('pattern', keys(PATTERNS));
  set('twillRatio', TWILL_RATIOS);
  set('twillDirection', keys(TWILL_DIRECTIONS));
  set('denim', ['yes', 'no'], (v) => v === 'yes');
  set('dye', keys(DYES));
  // Keep the corrected set consistent: a pattern must fit its construction, twill details need twill.
  if (a.pattern && a.construction && !(PATTERNS_BY_CONSTRUCTION[a.construction as keyof typeof PATTERNS_BY_CONSTRUCTION] as readonly unknown[]).includes(a.pattern)) delete a.pattern;
  if (a.pattern !== 'twill') {
    delete a.twillRatio;
    delete a.twillDirection;
  }

  const fibre = one(params.fibre);
  const unit = one(params.unit) === 'oz' ? 'oz' : 'gsm';
  const weight = (v: string) => {
    const n = num.safeParse(v);
    return n.success ? (unit === 'oz' ? ozToGsm(n.data) : Math.round(n.data)) : null;
  };
  const filters: FabricFilters = {
    fibre: fibre in FIBRES ? (fibre as FibreCode) : null,
    gsmMin: one(params.wmin) ? weight(one(params.wmin)) : null,
    gsmMax: one(params.wmax) ? weight(one(params.wmax)) : null,
  };
  return { attributes: a as Attributes, filters, changed };
}
