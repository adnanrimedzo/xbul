import { z } from 'zod';
import { DomainError } from '@/shared/domain/errors';
import { COLORS, CONSTRUCTIONS, DYES, PATTERNS, PATTERNS_BY_CONSTRUCTION, PRODUCT_TYPES, TWILL_DIRECTIONS, TWILL_RATIOS, type ColorId, type ProductTypeId } from '@/shared/domain/taxonomy';
import { ATTR_KEYS, confidentAttributes, NOTHING_SEEN, type Attributes, type SeenAttributes, type ViewKind } from './fabric-attributes';
import { NO_FABRIC, PHOTO_CATEGORIES, type PhotoCategory, type PhotoTags } from './photo-tags';

export const MODEL_REASONS = ['ok', 'not_textile', 'no_product', 'multiple_products', 'too_dark_or_blurry', 'unsafe'] as const;
export type ModelReason = (typeof MODEL_REASONS)[number];
export type GateReason = Exclude<ModelReason, 'ok'> | 'uncertain';
export type GateDecision = 'accepted' | 'unclear' | 'rejected';
const VIEW_KINDS = ['close_up', 'product', 'worn'] as const;

// What the vision model must answer: enums only, so nothing it writes is ever shown as free text.
export type Verdict = Readonly<{
  textile: boolean;
  reason: ModelReason;
  confidence: number;
  category: PhotoCategory | null;
  productType: ProductTypeId | null;
  colors: readonly ColorId[];
  viewKind: ViewKind;
  seen: SeenAttributes;
}>;

const keys = (o: object) => Object.keys(o) as [string, ...string[]];
const seenSchema = (values: readonly (string | boolean)[] | 'boolean') => ({
  type: ['object', 'null'],
  properties: { value: values === 'boolean' ? { type: 'boolean' } : { type: 'string', enum: values }, confidence: { type: 'number', minimum: 0, maximum: 1 } },
  required: ['value', 'confidence'],
  additionalProperties: false,
});

// JSON schema handed to the model as response_format.
export const VERDICT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    textile: { type: 'boolean' },
    reason: { type: 'string', enum: MODEL_REASONS },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    category: { type: ['string', 'null'], enum: [...PHOTO_CATEGORIES, null] },
    productType: { type: ['string', 'null'], enum: [...keys(PRODUCT_TYPES), null] },
    colors: { type: 'array', items: { type: 'string', enum: keys(COLORS) }, maxItems: 3 },
    viewKind: { type: 'string', enum: VIEW_KINDS },
    construction: seenSchema(keys(CONSTRUCTIONS)),
    pattern: seenSchema(keys(PATTERNS)),
    twillRatio: seenSchema(TWILL_RATIOS),
    twillDirection: seenSchema(keys(TWILL_DIRECTIONS)),
    denim: seenSchema('boolean'),
    dye: seenSchema(keys(DYES)),
  },
  required: ['textile', 'reason', 'confidence', 'category', 'productType', 'colors', 'viewKind'],
  additionalProperties: false,
} as const;

// Lenient on details (an unknown enum value becomes null) but strict on the gate fields: without them there is no answer.
const unit = z.number().transform((n) => Math.min(1, Math.max(0, n)));
const enumOrNull = (values: readonly string[]) => z.unknown().optional().transform((v) => (typeof v === 'string' && values.includes(v) ? v : null));
const seen = (values: readonly string[] | 'boolean') =>
  z.unknown().optional().transform((v) => {
    const r = z.object({ value: z.unknown(), confidence: unit }).safeParse(v);
    if (!r.success) return null;
    const ok = values === 'boolean' ? typeof r.data.value === 'boolean' : typeof r.data.value === 'string' && values.includes(r.data.value);
    return ok ? { value: r.data.value, confidence: r.data.confidence } : null;
  });

const schema = z.object({
  textile: z.boolean(),
  reason: z.unknown().optional().transform((v) => ((MODEL_REASONS as readonly unknown[]).includes(v) ? (v as ModelReason) : 'ok')),
  confidence: unit,
  category: enumOrNull(PHOTO_CATEGORIES),
  productType: enumOrNull(keys(PRODUCT_TYPES)),
  colors: z.unknown().optional().transform((v) => (Array.isArray(v) ? [...new Set(v.filter((c) => typeof c === 'string' && c in COLORS))].slice(0, 3) : [])),
  viewKind: z.unknown().optional().transform((v) => ((VIEW_KINDS as readonly unknown[]).includes(v) ? (v as ViewKind) : 'product')),
  construction: seen(keys(CONSTRUCTIONS)),
  pattern: seen(keys(PATTERNS)),
  twillRatio: seen(TWILL_RATIOS),
  twillDirection: seen(keys(TWILL_DIRECTIONS)),
  denim: seen('boolean'),
  dye: seen(keys(DYES)),
});

export function parseVerdict(raw: unknown): Verdict {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new DomainError('photo.ai_unavailable');
    }
  }
  const r = schema.safeParse(value);
  if (!r.success) throw new DomainError('photo.ai_unavailable');
  const { construction, pattern, twillRatio, twillDirection, denim, dye, ...rest } = r.data;
  return Object.freeze({
    ...rest,
    category: rest.category as PhotoCategory | null,
    productType: rest.productType as ProductTypeId | null,
    colors: rest.colors as ColorId[],
    seen: { ...NOTHING_SEEN, construction, pattern, twillRatio, twillDirection, denim, dye } as SeenAttributes,
  });
}

export const MIN_GATE_CONFIDENCE = 0.5;

export function gateDecision(v: Verdict): { decision: GateDecision; reason: GateReason | null } {
  if (v.reason === 'unsafe') return { decision: 'rejected', reason: 'unsafe' };
  if (!v.textile) return { decision: 'rejected', reason: v.reason === 'no_product' ? 'no_product' : 'not_textile' };
  if (v.reason === 'multiple_products' || v.reason === 'too_dark_or_blurry') return { decision: 'unclear', reason: v.reason };
  if (v.confidence < MIN_GATE_CONFIDENCE) return { decision: 'unclear', reason: 'uncertain' };
  return { decision: 'accepted', reason: null };
}

// The supplier's review form starts from these; only confident fabric details are suggested.
export function suggestedTags(v: Verdict): PhotoTags {
  const a = confidentAttributes(v.seen, v.viewKind);
  // Keep only a pattern that fits the construction, so the suggestion always passes normalizeTags unchanged.
  const pattern = a.construction && a.pattern && PATTERNS_BY_CONSTRUCTION[a.construction].includes(a.pattern) ? a.pattern : null;
  const twill = pattern === 'twill';
  return Object.freeze({
    category: v.category ?? 'garment',
    productType: v.productType,
    colors: v.colors,
    title: null,
    fabric: Object.freeze({
      ...NO_FABRIC,
      construction: a.construction ?? null,
      pattern,
      twillRatio: twill ? (a.twillRatio ?? null) : null,
      twillDirection: twill ? (a.twillDirection ?? null) : null,
      denim: a.denim ?? null,
      dye: a.dye ?? null,
    }),
  });
}

// What the buyer's photos say about the fabric: the main photo judged at its own distance, the optional close-up judged
// as a close-up. Where both are confident, the more confident sighting wins.
export function buyerAttributes(main: Verdict, closeUp: Verdict | null): Attributes {
  const a: Record<string, unknown> = { ...confidentAttributes(main.seen, main.viewKind) };
  if (closeUp) {
    const b = confidentAttributes(closeUp.seen, 'close_up') as Record<string, unknown>;
    for (const k of ATTR_KEYS) {
      if (b[k] === undefined) continue;
      if (a[k] === undefined || (closeUp.seen[k]?.confidence ?? 0) > (main.seen[k]?.confidence ?? 0)) a[k] = b[k];
    }
  }
  if (a.pattern !== 'twill') {
    delete a.twillRatio;
    delete a.twillDirection;
  }
  return a as Attributes;
}
