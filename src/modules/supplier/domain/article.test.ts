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
  expect(a).toMatchObject({ code: '60219/1', slug: '60219-1', specs: { weight: null, moq: null } });
});

it('takes weight and MOQ as free text in the supplier’s own units', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(withSpecs(a, { weight: ' 240 g/m² ', moq: '500 pieces' }).specs).toMatchObject({ weight: '240 g/m²', moq: '500 pieces' });
  expect(withSpecs(a, { weight: '', moq: '' }).specs).toMatchObject({ weight: null, moq: null });
  expect(() => withSpecs(a, { moq: 'x'.repeat(61) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
  expect(() => withSpecs(a, { weight: 'x'.repeat(61) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
});

it('validates specs', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(withSpecs(a, { moq: '1,000 m', weight: '12.5 oz', composition: ' 98% CO 2% EA ', finish: '' }).specs)
    .toEqual({ moq: '1,000 m', weight: '12.5 oz', composition: '98% CO 2% EA', finish: null, leadTimeWeeks: null });
  expect(() => withSpecs(a, { leadTimeWeeks: 2.5 })).toThrow(expect.objectContaining({ code: 'article.lead_time_invalid' }));
});

it('keeps unpatched specs (even undefined ones), clears on null, and caps text length', () => {
  const a = withSpecs(createArticle({ companyId: 'c1', code: '60219/1' }), { moq: '500 m', finish: 'Rinse' });
  const b = withSpecs(a, { moq: undefined, finish: null, leadTimeWeeks: 0 });
  expect(b.specs).toMatchObject({ moq: '500 m', finish: null, leadTimeWeeks: 0 });
  expect(() => withSpecs(a, { composition: 'x'.repeat(121) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
  expect(() => withSpecs(a, { finish: 'x'.repeat(81) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
});

it('rejects a code that slugs to nothing', () => {
  expect(() => createArticle({ companyId: 'c1', code: '///' })).toThrow(expect.objectContaining({ code: 'article.code_invalid' }));
});
