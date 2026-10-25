import { expect, it } from 'vitest';
import { createArticle, normalizeArticleCode, withSpecs } from './article';

it.each([[' 60219/1 ', '60219/1'], [' ab  12 ', 'AB 12']])('normalizes %j', (raw, code) =>
  expect(normalizeArticleCode(raw)).toBe(code));

it('rejects empty or >40-char codes', () => {
  expect(() => normalizeArticleCode('  ')).toThrow(expect.objectContaining({ code: 'article.code_invalid' }));
  expect(() => normalizeArticleCode('x'.repeat(41))).toThrow(expect.objectContaining({ code: 'article.code_invalid' }));
});

it('slugs the code and starts with empty specs', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(a).toMatchObject({ code: '60219/1', slug: '60219-1', specs: { weightOz: null, moqMeters: null } });
});

it('validates specs', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(withSpecs(a, { moqMeters: 1000, weightOz: 12.5, composition: ' 98% CO 2% EA ', finish: '' }).specs)
    .toEqual({ moqMeters: 1000, weightOz: 12.5, composition: '98% CO 2% EA', finish: null, leadTimeWeeks: null });
  expect(() => withSpecs(a, { moqMeters: 0 })).toThrow(expect.objectContaining({ code: 'article.moq_invalid' }));
  expect(() => withSpecs(a, { leadTimeWeeks: 2.5 })).toThrow(expect.objectContaining({ code: 'article.lead_time_invalid' }));
  expect(() => withSpecs(a, { weightOz: 41 })).toThrow(expect.objectContaining({ code: 'article.weight_invalid' }));
});

it('keeps unpatched specs (even undefined ones), clears on null, and caps text length', () => {
  const a = withSpecs(createArticle({ companyId: 'c1', code: '60219/1' }), { moqMeters: 500, finish: 'Rinse' });
  const b = withSpecs(a, { moqMeters: undefined, finish: null, leadTimeWeeks: 0 });
  expect(b.specs).toMatchObject({ moqMeters: 500, finish: null, leadTimeWeeks: 0 });
  expect(() => withSpecs(a, { composition: 'x'.repeat(121) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
  expect(() => withSpecs(a, { finish: 'x'.repeat(81) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
});

it('rejects a code that slugs to nothing', () => {
  expect(() => createArticle({ companyId: 'c1', code: '///' })).toThrow(expect.objectContaining({ code: 'article.code_invalid' }));
});
