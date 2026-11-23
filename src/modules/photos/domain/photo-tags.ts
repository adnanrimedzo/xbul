import { DomainError } from '@/shared/domain/errors';
import {
  COLORS, CONSTRUCTIONS, DYES, PATTERNS, PATTERNS_BY_CONSTRUCTION, PRODUCT_TYPES, TWILL_DIRECTIONS, TWILL_RATIOS,
  type ColorId, type Construction, type DyeMethod, type PartId, type Pattern, type ProductTypeId,
} from '@/shared/domain/taxonomy';

export const PHOTO_CATEGORIES = ['garment', 'fabric', 'yarn', 'trims'] as const satisfies readonly PartId[];
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];
export type TwillRatio = (typeof TWILL_RATIOS)[number];
export type TwillDirection = keyof typeof TWILL_DIRECTIONS;

export const MAX_PHOTO_COLORS = 3;
export const MAX_PHOTO_TITLE = 80;

// What a photo shows of its fabric. Every field is optional: a supplier fills in what they know, and a photo of a whole
// garment rarely shows the weave. Fibres and weight are not here: no photo shows them, so they live on articles.
export type PhotoFabric = Readonly<{
  construction: Construction | null;
  pattern: Pattern | null;
  twillRatio: TwillRatio | null;
  twillDirection: TwillDirection | null;
  denim: boolean | null;
  dye: DyeMethod | null;
}>;

export type PhotoTags = Readonly<{
  category: PhotoCategory;
  productType: ProductTypeId | null;
  colors: readonly ColorId[];
  title: string | null;
  fabric: PhotoFabric;
}>;

export type PhotoTagsInput = {
  category?: string;
  productType?: string;
  colors?: readonly string[];
  title?: string;
  construction?: string;
  pattern?: string;
  twillRatio?: string;
  twillDirection?: string;
  denim?: string | boolean | null;
  dye?: string;
};

export const NO_FABRIC: PhotoFabric = Object.freeze({ construction: null, pattern: null, twillRatio: null, twillDirection: null, denim: null, dye: null });

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const blank = (v: string | undefined) => (v ?? '').trim();
const oneOf = <T extends string>(v: string | undefined, allowed: object, code: string): T | null => {
  const s = blank(v);
  if (!s) return null;
  if (!has(allowed, s)) throw new DomainError(code);
  return s as T;
};

export function normalizeTags(input: PhotoTagsInput): PhotoTags {
  const category = blank(input.category);
  if (!(PHOTO_CATEGORIES as readonly string[]).includes(category)) throw new DomainError('photo.category_invalid');

  const productType = oneOf<ProductTypeId>(input.productType, PRODUCT_TYPES, 'photo.product_type_invalid');

  const colors = [...new Set((input.colors ?? []).map((c) => c.trim()).filter(Boolean))];
  if (colors.length > MAX_PHOTO_COLORS || !colors.every((c) => has(COLORS, c))) throw new DomainError('photo.colors_invalid');

  const title = blank(input.title).replace(/\s+/g, ' ');
  if (title.length > MAX_PHOTO_TITLE) throw new DomainError('photo.title_invalid');

  const construction = oneOf<Construction>(input.construction, CONSTRUCTIONS, 'fabric.construction_invalid');
  const pattern = oneOf<Pattern>(input.pattern, PATTERNS, 'fabric.pattern_invalid');
  if (pattern && (!construction || !(PATTERNS_BY_CONSTRUCTION[construction] as readonly string[]).includes(pattern))) {
    throw new DomainError('fabric.pattern_invalid');
  }
  const ratio = blank(input.twillRatio);
  if (ratio && !(TWILL_RATIOS as readonly string[]).includes(ratio)) throw new DomainError('fabric.twill_invalid');
  const twillDirection = oneOf<TwillDirection>(input.twillDirection, TWILL_DIRECTIONS, 'fabric.twill_invalid');
  if ((ratio || twillDirection) && pattern !== 'twill') throw new DomainError('fabric.twill_invalid');

  const d = input.denim;
  const denim = d === true || d === 'true' || d === 'yes' ? true : d === false || d === 'false' || d === 'no' ? false : null;

  return Object.freeze({
    category: category as PhotoCategory,
    productType,
    colors: colors as ColorId[],
    title: title || null,
    fabric: Object.freeze({
      construction, pattern, twillRatio: (ratio || null) as TwillRatio | null, twillDirection, denim,
      dye: oneOf<DyeMethod>(input.dye, DYES, 'fabric.dye_invalid'),
    }),
  });
}
