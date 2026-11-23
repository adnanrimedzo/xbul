import type { ColorId, FabricSpec, ProductTypeId } from '@/shared/domain/taxonomy';
import { compareAttributes, matchesFilters, NO_FILTERS, supplierAttributes, type Attributes, type AttrKey, type FabricFilters } from './fabric-attributes';
import type { PhotoCategory, PhotoTags } from './photo-tags';

// A candidate is a supplier photo found by visual similarity, or (for fabric close-ups) a supplier article whose
// fabric spec alone may match. `spec` is the linked article's fabric spec, when there is one.
export type MatchCandidate = Readonly<{
  companyId: string;
  photoId: string | null;
  articleId: string | null;
  similarity: number | null;
  tags: PhotoTags | null;
  spec: FabricSpec | null;
}>;

export type BuyerQuery = Readonly<{
  attributes: Attributes;
  category: PhotoCategory | null;
  productType: ProductTypeId | null;
  colors: readonly ColorId[];
  filters: FabricFilters;
}>;

export type MatchLabel = 'same' | 'similar' | 'spec';
export type Reason = AttrKey | 'category' | 'productType' | 'colors';

export type RankedMatch = Readonly<{
  photoId: string | null;
  articleId: string | null;
  label: MatchLabel;
  score: number;
  similarity: number | null;
  agree: readonly Reason[];
}>;

export type CompanyMatches = Readonly<{ companyId: string; matches: readonly RankedMatch[] }>;

// ponytail: fixed weights, calibrated on staging with real photos (docs/runbook.md). Visual similarity is the backbone;
// each agreeing fabric attribute nudges a match up, each conflict pushes it down and rules out "looks the same".
export const THRESHOLDS = Object.freeze({ SAME: 0.92, SIMILAR: 0.78, SIMILAR_FLOOR: 0.7, W_AGREE: 0.02, W_CONFLICT: 0.04, SPEC_MIN_AGREE: 2 });
export const MAX_COMPANIES = 20;
export const MAX_MATCHES_PER_COMPANY = 3;

type Scored = RankedMatch & { companyId: string; tier: number };

function softAgreement(q: BuyerQuery, tags: PhotoTags | null): Reason[] {
  if (!tags) return [];
  const out: Reason[] = [];
  if (q.category && q.category === tags.category) out.push('category');
  if (q.productType && q.productType === tags.productType) out.push('productType');
  if (q.colors.some((c) => tags.colors.includes(c))) out.push('colors');
  return out;
}

function score(c: MatchCandidate, q: BuyerQuery, t: typeof THRESHOLDS): Scored | null {
  const filtered = matchesFilters(c.spec, q.filters ?? NO_FILTERS);
  if (filtered === false) return null;
  const { agree, conflict } = compareAttributes(q.attributes, supplierAttributes(c.tags?.fabric ?? null, c.spec));
  const soft = softAgreement(q, c.tags);
  const base = { companyId: c.companyId, photoId: c.photoId, articleId: c.articleId, similarity: c.similarity, agree: [...agree, ...soft] };

  if (c.similarity === null) {
    // Spec-only article match: needs real fabric agreement and no contradiction.
    if (agree.length < t.SPEC_MIN_AGREE || conflict.length > 0) return null;
    return { ...base, label: 'spec', score: agree.length * t.W_AGREE, tier: 2 };
  }
  if (c.similarity < t.SIMILAR_FLOOR) return null;
  const s = c.similarity + t.W_AGREE * (agree.length + soft.length / 2) - t.W_CONFLICT * conflict.length;
  const label: MatchLabel | null = c.similarity >= t.SAME && conflict.length === 0 ? 'same' : s >= t.SIMILAR ? 'similar' : null;
  if (!label) return null;
  // Photos that passed the filters on a real spec rank before those with no spec to judge.
  return { ...base, label, score: s, tier: filtered === null ? 1 : 0 };
}

const byRank = (a: Scored, b: Scored) =>
  a.tier - b.tier || b.score - a.score || String(a.photoId ?? a.articleId).localeCompare(String(b.photoId ?? b.articleId));

export function rankMatches(candidates: readonly MatchCandidate[], q: BuyerQuery, t: typeof THRESHOLDS = THRESHOLDS): CompanyMatches[] {
  const scored = candidates.map((c) => score(c, q, t)).filter((s): s is Scored => s !== null).sort(byRank);
  const groups = new Map<string, Scored[]>();
  for (const s of scored) {
    const g = groups.get(s.companyId) ?? [];
    // An article shown through its photo needn't appear again as a spec-only match.
    if (s.label === 'spec' && g.some((m) => m.articleId === s.articleId)) continue;
    g.push(s);
    groups.set(s.companyId, g);
  }
  // Map keeps insertion order, and insertion follows the sorted best match of each company.
  return [...groups.entries()].slice(0, MAX_COMPANIES).map(([companyId, g]) => ({
    companyId,
    matches: g.slice(0, MAX_MATCHES_PER_COMPANY).map((m) => ({ photoId: m.photoId, articleId: m.articleId, label: m.label, score: m.score, similarity: m.similarity, agree: m.agree })),
  }));
}
