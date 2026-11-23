import { describe, expect, it } from 'vitest';
import { normalizeFabricSpec } from '@/shared/domain/taxonomy';
import {
  compareAttributes, confidentAttributes, matchesFilters, NO_FILTERS, NOTHING_SEEN, ozToGsm, supplierAttributes,
  type SeenAttributes,
} from './fabric-attributes';
import { isExpired, searchPhotoKey } from './photo-check';
import { normalizeTags } from './photo-tags';
import { rankMatches, THRESHOLDS, type BuyerQuery, type MatchCandidate } from './rank-matches';
import { assertPhotoCapacity, createSupplierPhoto, editPhoto, MAX_COMPANY_PHOTOS, publishPhoto, unpublishPhoto } from './supplier-photo';
import { buyerAttributes, gateDecision, parseVerdict, suggestedTags } from './verdict';

const denimSpec = normalizeFabricSpec({
  construction: 'woven', pattern: 'twill', twillRatio: '3/1', twillDirection: 'rht', fibres: [{ code: 'CO', percent: 98 }, { code: 'EL', percent: 2 }],
  weight: 12, weightUnit: 'oz', dye: 'rope',
});
const jerseySpec = normalizeFabricSpec({ construction: 'knitted', pattern: 'single_jersey', fibres: [{ code: 'CO', percent: 100 }], weight: 180 });

describe('normalizeTags', () => {
  it('accepts a full set and trims the title', () => {
    const t = normalizeTags({ category: 'garment', productType: 'jacket', colors: ['blue', 'blue', 'navy'], title: '  Trucker   jacket ', construction: 'woven', pattern: 'twill', twillRatio: '3/1', twillDirection: 'rht', denim: 'yes', dye: 'rope' });
    expect(t).toMatchObject({ category: 'garment', productType: 'jacket', colors: ['blue', 'navy'], title: 'Trucker jacket', fabric: { pattern: 'twill', twillRatio: '3/1', denim: true } });
  });

  it('leaves everything optional except the category', () => {
    expect(normalizeTags({ category: 'fabric' })).toMatchObject({ productType: null, colors: [], title: null, fabric: { construction: null, denim: null } });
    expect(() => normalizeTags({ category: 'shoe' })).toThrow('photo.category_invalid');
  });

  it.each([
    [{ productType: 'boots' }, 'photo.product_type_invalid'],
    [{ colors: ['blue', 'red', 'green', 'black'] }, 'photo.colors_invalid'],
    [{ colors: ['teal'] }, 'photo.colors_invalid'],
    [{ title: 'x'.repeat(81) }, 'photo.title_invalid'],
    [{ construction: 'knitted', pattern: 'twill' }, 'fabric.pattern_invalid'],
    [{ pattern: 'twill' }, 'fabric.pattern_invalid'],
    [{ construction: 'woven', pattern: 'plain', twillRatio: '3/1' }, 'fabric.twill_invalid'],
    [{ construction: 'woven', pattern: 'twill', twillRatio: '4/1' }, 'fabric.twill_invalid'],
    [{ dye: 'tie_dye' }, 'fabric.dye_invalid'],
  ])('rejects %o', (input, code) => {
    expect(() => normalizeTags({ category: 'garment', ...input })).toThrow(code);
  });
});

const seen = (o: Partial<Record<keyof SeenAttributes, [unknown, number]>>): SeenAttributes =>
  ({ ...NOTHING_SEEN, ...Object.fromEntries(Object.entries(o).map(([k, [value, confidence]]) => [k, { value, confidence }])) }) as SeenAttributes;

describe('fabric attributes', () => {
  const twill = seen({ construction: ['woven', 0.9], pattern: ['twill', 0.7], twillRatio: ['3/1', 0.7], denim: [true, 0.95], dye: ['rope', 0.4] });

  it('needs a higher bar for the weave unless the photo is a close-up', () => {
    expect(confidentAttributes(twill, 'product')).toEqual({ construction: 'woven', denim: true });
    expect(confidentAttributes(twill, 'close_up')).toEqual({ construction: 'woven', pattern: 'twill', twillRatio: '3/1', denim: true });
  });

  it('drops twill details when the pattern itself is not twill', () => {
    expect(confidentAttributes(seen({ pattern: ['plain', 0.9], twillRatio: ['3/1', 0.9] }), 'close_up')).toEqual({ pattern: 'plain' });
  });

  it('compares: missing is neutral, twill details only when both are twill', () => {
    const supplier = supplierAttributes(null, denimSpec);
    expect(compareAttributes({ construction: 'woven', pattern: 'twill', twillRatio: '3/1', denim: true }, supplier)).toEqual({
      agree: ['construction', 'pattern', 'twillRatio', 'denim'], conflict: [],
    });
    expect(compareAttributes({ construction: 'knitted', twillRatio: '2/1' }, supplier)).toEqual({ agree: [], conflict: ['construction'] });
    expect(compareAttributes({ construction: 'woven' }, {})).toEqual({ agree: [], conflict: [] });
  });

  it('lets the photo tags override the linked article spec', () => {
    const tags = normalizeTags({ category: 'garment', construction: 'woven', pattern: 'plain' });
    expect(supplierAttributes(tags.fabric, denimSpec)).toMatchObject({ pattern: 'plain', construction: 'woven', dye: 'rope' });
  });

  it('filters on fibre and weight, null when there is no spec', () => {
    expect(matchesFilters(denimSpec, NO_FILTERS)).toBe(true);
    expect(matchesFilters(denimSpec, { fibre: 'CO', gsmMin: ozToGsm(11), gsmMax: ozToGsm(13) })).toBe(true);
    expect(matchesFilters(denimSpec, { fibre: 'WO', gsmMin: null, gsmMax: null })).toBe(false);
    expect(matchesFilters(denimSpec, { fibre: null, gsmMin: 500, gsmMax: null })).toBe(false);
    expect(matchesFilters(null, { fibre: 'CO', gsmMin: null, gsmMax: null })).toBeNull();
  });
});

describe('verdict', () => {
  const raw = {
    textile: true, reason: 'ok', confidence: 0.9, category: 'garment', productType: 'jacket', colors: ['blue', 'teal', 'blue'], viewKind: 'product',
    construction: { value: 'woven', confidence: 0.9 }, pattern: { value: 'twill', confidence: 0.95 }, twillRatio: { value: '9/9', confidence: 1 }, denim: { value: true, confidence: 0.9 },
  };

  it('parses leniently: unknown enums become null, confidence is clamped', () => {
    const v = parseVerdict(JSON.stringify({ ...raw, confidence: 7, productType: 'boots' }));
    expect(v).toMatchObject({ textile: true, confidence: 1, productType: null, colors: ['blue'] });
    expect(v.seen.twillRatio).toBeNull();
    expect(v.seen.pattern).toEqual({ value: 'twill', confidence: 0.95 });
  });

  it('refuses an answer without the gate fields', () => {
    expect(() => parseVerdict('not json')).toThrow('photo.ai_unavailable');
    expect(() => parseVerdict({ reason: 'ok' })).toThrow('photo.ai_unavailable');
  });

  it.each([
    [{ reason: 'unsafe' }, 'rejected', 'unsafe'],
    [{ textile: false, reason: 'not_textile' }, 'rejected', 'not_textile'],
    [{ textile: false, reason: 'no_product' }, 'rejected', 'no_product'],
    [{ textile: false, reason: 'ok' }, 'rejected', 'not_textile'],
    [{ reason: 'multiple_products' }, 'unclear', 'multiple_products'],
    [{ reason: 'too_dark_or_blurry' }, 'unclear', 'too_dark_or_blurry'],
    [{ confidence: 0.3 }, 'unclear', 'uncertain'],
    [{}, 'accepted', null],
  ])('decides %o as %s', (patch, decision, reason) => {
    expect(gateDecision(parseVerdict({ ...raw, ...patch }))).toEqual({ decision, reason });
  });

  it('adds the close-up judged as a close-up; the more confident sighting wins', () => {
    const main = parseVerdict({ ...raw, pattern: { value: 'twill', confidence: 0.7 }, twillRatio: { value: '3/1', confidence: 0.7 } });
    expect(buyerAttributes(main, null)).toEqual({ construction: 'woven', denim: true });
    const closeUp = parseVerdict({ ...raw, viewKind: 'close_up', construction: { value: 'knitted', confidence: 0.6 }, pattern: { value: 'twill', confidence: 0.8 }, twillRatio: { value: '3/1', confidence: 0.8 } });
    expect(buyerAttributes(main, closeUp)).toEqual({ construction: 'woven', pattern: 'twill', twillRatio: '3/1', denim: true });
  });

  it('suggests only confident tags that pass normalizeTags', () => {
    const t = suggestedTags(parseVerdict({ ...raw, construction: { value: 'knitted', confidence: 0.9 } }));
    expect(t.fabric).toMatchObject({ construction: 'knitted', pattern: null, twillRatio: null, denim: true });
    expect(() => normalizeTags({ category: t.category, construction: t.fabric.construction ?? '', pattern: t.fabric.pattern ?? '' })).not.toThrow();
  });
});

describe('supplier photo and checks', () => {
  it('moves between draft and published', () => {
    const tags = normalizeTags({ category: 'garment' });
    const draft = createSupplierPhoto({ companyId: 'c1', tags, embedding: [1], embeddingModel: 'm' }, new Date('2026-01-01'));
    expect(draft).toMatchObject({ status: 'draft', photoKey: `supplier-photos/c1/${draft.id}`, publishedAt: null });
    const pub = publishPhoto(draft, tags, 'a1', new Date('2026-01-02'));
    expect(pub).toMatchObject({ status: 'published', articleId: 'a1' });
    expect(editPhoto(pub, tags, null).publishedAt).toEqual(pub.publishedAt);
    expect(unpublishPhoto(pub)).toMatchObject({ status: 'draft', publishedAt: null });
    expect(() => assertPhotoCapacity(MAX_COMPANY_PHOTOS)).toThrow('photo.limit');
  });

  it('expires buyer searches after 7 days and dates their keys', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    expect(isExpired(new Date('2026-03-04T12:00:00Z'), now)).toBe(false);
    expect(isExpired(new Date('2026-03-03T11:00:00Z'), now)).toBe(true);
    expect(searchPhotoKey('abc', now)).toBe('photo-searches/20260310/abc');
  });
});

describe('rankMatches', () => {
  const q: BuyerQuery = { attributes: { construction: 'woven', pattern: 'twill', denim: true }, category: 'garment', productType: 'jacket', colors: ['blue'], filters: NO_FILTERS };
  const photo = (companyId: string, photoId: string, similarity: number, spec: MatchCandidate['spec'] = null, tags: MatchCandidate['tags'] = null): MatchCandidate =>
    ({ companyId, photoId, articleId: spec ? `art-${photoId}` : null, similarity, tags, spec });

  it('labels by visual similarity and drops weak matches', () => {
    const r = rankMatches([photo('a', 'p1', 0.95), photo('b', 'p2', 0.8), photo('c', 'p3', 0.6)], q);
    expect(r.map((c) => [c.companyId, c.matches[0].label])).toEqual([['a', 'same'], ['b', 'similar']]);
  });

  it('lets agreeing attributes lift an equal-looking match', () => {
    const r = rankMatches([photo('a', 'p1', 0.85, jerseySpec), photo('b', 'p2', 0.85, denimSpec)], q);
    expect(r[0].companyId).toBe('b');
    expect(r[0].matches[0].agree).toEqual(['construction', 'pattern', 'denim']);
  });

  it('never calls a conflicting match the same', () => {
    expect(rankMatches([photo('a', 'p1', 0.95, jerseySpec)], q)[0].matches[0].label).toBe('similar');
  });

  it('applies filters hard on specs and ranks unknown specs last', () => {
    const filters = { fibre: 'CO' as const, gsmMin: 300, gsmMax: null };
    const r = rankMatches([photo('a', 'p1', 0.99), photo('b', 'p2', 0.85, denimSpec), photo('c', 'p3', 0.99, jerseySpec)], { ...q, filters });
    expect(r.map((c) => c.companyId)).toEqual(['b', 'a']);
  });

  it('adds spec-only article matches after visual ones, never twice', () => {
    const article = (companyId: string, articleId: string, spec: MatchCandidate['spec']): MatchCandidate => ({ companyId, photoId: null, articleId, similarity: null, tags: null, spec });
    const r = rankMatches([article('z', 'a9', denimSpec), photo('y', 'p1', 0.8), article('x', 'a8', jerseySpec), article('y', 'art-p2', denimSpec), photo('y', 'p2', 0.9, denimSpec)], q);
    expect(r.map((c) => c.companyId)).toEqual(['y', 'z']);
    expect(r[0].matches.map((m) => m.label)).toEqual(['similar', 'similar']);
    expect(r[1].matches[0].label).toBe('spec');
  });

  it('caps companies and matches per company with a stable order', () => {
    const many = Array.from({ length: 30 }, (_, i) => photo(`c${String(i).padStart(2, '0')}`, `p${i}`, 0.9));
    const r = rankMatches([...many, photo('c00', 'q1', 0.9), photo('c00', 'q2', 0.9), photo('c00', 'q3', 0.9)], q);
    expect(r).toHaveLength(20);
    expect(r[0].matches).toHaveLength(3);
    expect(rankMatches([], q)).toEqual([]);
    expect(THRESHOLDS.SAME).toBeGreaterThan(THRESHOLDS.SIMILAR);
  });
});
