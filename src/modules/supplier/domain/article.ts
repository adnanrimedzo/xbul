import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { slugify } from '@/shared/domain/slug';
import { normalizeFabricSpec, type FabricSpec, type FabricSpecInput } from '@/shared/domain/taxonomy';

export type ArticleSpecs = Readonly<{
  weight: string | null;
  composition: string | null;
  finish: string | null;
  moq: string | null;
  leadTimeWeeks: number | null;
}>;

export type Article = Readonly<{
  id: string;
  companyId: string;
  code: string;
  slug: string;
  specs: ArticleSpecs;
  fabric: FabricSpec | null;
  createdAt: Date;
}>;

export function normalizeArticleCode(raw: string): string {
  const code = raw.trim().replace(/\s+/g, ' ').toUpperCase();
  if (code.length < 1 || code.length > 40) throw new DomainError('article.code_invalid');
  return code;
}

export function createArticle(input: { companyId: string; code: string }, now: Date = new Date()): Article {
  const code = normalizeArticleCode(input.code);
  const slug = slugify(code);
  if (!slug) throw new DomainError('article.code_invalid');
  const specs: ArticleSpecs = Object.freeze({ weight: null, composition: null, finish: null, moq: null, leadTimeWeeks: null });
  return Object.freeze({ id: newId(), companyId: input.companyId, code, slug, specs, fabric: null, createdAt: now });
}

const text = (v: string | null, max: number): string | null => {
  const t = v?.trim() ?? '';
  if (t.length > max) throw new DomainError('article.text_too_long');
  return t || null;
};

const int = (v: number | null, min: number, max: number, code: string): number | null => {
  if (v === null) return null;
  if (!Number.isInteger(v) || v < min || v > max) throw new DomainError(code);
  return v;
};

// Keys absent (or undefined) in `patch` keep their current value; `null` or a blank string clears one.
export function withSpecs(a: Article, patch: Partial<ArticleSpecs>): Article {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<ArticleSpecs>;
  const s = { ...a.specs, ...defined };
  const specs: ArticleSpecs = Object.freeze({
    weight: text(s.weight, 60),
    composition: text(s.composition, 120),
    finish: text(s.finish, 80),
    moq: text(s.moq, 60),
    leadTimeWeeks: int(s.leadTimeWeeks, 0, 52, 'article.lead_time_invalid'),
  });
  return Object.freeze({ ...a, specs });
}

// null clears the technical sheet.
export function withFabric(a: Article, input: FabricSpecInput | null): Article {
  return Object.freeze({ ...a, fabric: input === null ? null : normalizeFabricSpec(input) });
}
