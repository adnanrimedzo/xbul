import type { Locale } from '@/i18n/locales';
import type { Attributes, PhotoCategory, PhotoFabric, Reason } from '@/modules/photos';
import { COLORS, CONSTRUCTIONS, DYES, PATTERNS, PRODUCT_TYPES, TWILL_DIRECTIONS, type ColorId, type ProductTypeId } from '@/shared/domain/taxonomy';
import { PHOTO } from './messages';

export type Seen = { category: PhotoCategory | null; productType: ProductTypeId | null; colors: readonly ColorId[]; attributes: Attributes };

// The chips for what a photo shows, from enums only, in the page's language: "Jacket or blazer · Blue · Woven · Twill · 3/1 …".
export function seenLabels(lang: Locale, s: Seen): string[] {
  const a = s.attributes;
  const twill = a.twillRatio || a.twillDirection ? [a.twillRatio, a.twillDirection && TWILL_DIRECTIONS[a.twillDirection][lang]].filter(Boolean).join(' ') : null;
  return [
    s.productType ? PRODUCT_TYPES[s.productType].name[lang] : s.category && PHOTO[lang].categories[s.category],
    ...s.colors.map((c) => COLORS[c][lang]),
    a.construction && CONSTRUCTIONS[a.construction][lang],
    a.pattern && PATTERNS[a.pattern][lang],
    twill,
    a.denim === true ? PHOTO[lang].denim : null,
    a.dye && DYES[a.dye][lang],
  ].filter((x): x is string => !!x);
}

export function fabricAttributes(f: PhotoFabric): Attributes {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null)) as Attributes;
}

// "Matches: woven · twill · denim" for a result, from the attributes that agree with the buyer's photo.
export function reasonLabels(lang: Locale, reasons: readonly Reason[], seen: Seen): string[] {
  const one = (r: Reason): string | null => {
    switch (r) {
      case 'category': return seen.category && PHOTO[lang].categories[seen.category];
      case 'productType': return seen.productType && PRODUCT_TYPES[seen.productType].name[lang];
      case 'colors': return seen.colors[0] ? COLORS[seen.colors[0]][lang] : null;
      case 'construction': return seen.attributes.construction ? CONSTRUCTIONS[seen.attributes.construction][lang] : null;
      case 'pattern': return seen.attributes.pattern ? PATTERNS[seen.attributes.pattern][lang] : null;
      case 'twillRatio': return seen.attributes.twillRatio ?? null;
      case 'twillDirection': return seen.attributes.twillDirection ? TWILL_DIRECTIONS[seen.attributes.twillDirection][lang] : null;
      case 'denim': return seen.attributes.denim === true ? PHOTO[lang].denim : null;
      case 'dye': return seen.attributes.dye ? DYES[seen.attributes.dye][lang] : null;
    }
  };
  return reasons.map(one).filter((x): x is string => !!x);
}
