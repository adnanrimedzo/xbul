import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import { slugify } from '@/shared/domain/slug';

export type ArticleSpecs = Readonly<{
  weightOz: number | null;
  composition: string | null;
  finish: string | null;
  moqMeters: number | null;
  leadTimeWeeks: number | null;
}>;

export type Article = Readonly<{
  id: string;
  companyId: string;
  code: string;
  slug: string;
  specs: ArticleSpecs;
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
  const specs: ArticleSpecs = Object.freeze({ weightOz: null, composition: null, finish: null, moqMeters: null, leadTimeWeeks: null });
  return Object.freeze({ id: newId(), companyId: input.companyId, code, slug, specs, createdAt: now });
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
  const weightOz = s.weightOz;
  if (weightOz !== null && !(weightOz >= 1 && weightOz <= 40)) throw new DomainError('article.weight_invalid');
  const specs: ArticleSpecs = Object.freeze({
    weightOz,
    composition: text(s.composition, 120),
    finish: text(s.finish, 80),
    moqMeters: int(s.moqMeters, 1, 1_000_000, 'article.moq_invalid'),
    leadTimeWeeks: int(s.leadTimeWeeks, 0, 52, 'article.lead_time_invalid'),
  });
  return Object.freeze({ ...a, specs });
}
