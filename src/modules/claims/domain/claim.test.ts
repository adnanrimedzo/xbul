import { expect, it } from 'vitest';
import { declareClaim, redeclareClaim, verifyClaim } from './claim';

const base = { productId: 'p', companyId: 'c', articleId: 'a', kind: 'original' as const };

it('normalizes notes', () => {
  expect(declareClaim({ ...base, note: '   ' }).note).toBeNull();
  expect(declareClaim({ ...base, note: '  hello ' }).note).toBe('hello');
  expect(declareClaim(base).note).toBeNull();
  expect(declareClaim({ ...base, note: 'x'.repeat(280) }).note).toHaveLength(280);
  expect(() => declareClaim({ ...base, note: 'x'.repeat(281) })).toThrow(expect.objectContaining({ code: 'claim.note_too_long' }));
});

it('declares a frozen claim with matching timestamps', () => {
  const now = new Date(2026, 0, 1);
  const c = declareClaim(base, now);
  expect(c).toMatchObject({ ...base, status: 'declared', createdAt: now, updatedAt: now });
  expect(Object.isFrozen(c)).toBe(true);
});

it('verifies only originals', () => {
  expect(verifyClaim(declareClaim(base)).status).toBe('verified');
  expect(() => verifyClaim(declareClaim({ ...base, kind: 'equivalent' }))).toThrow(expect.objectContaining({ code: 'claim.only_original_verifiable' }));
});

it('verifying keeps createdAt and bumps updatedAt', () => {
  const c = declareClaim(base, new Date(2026, 0, 1));
  const later = new Date(2026, 0, 2);
  expect(verifyClaim(c, later)).toMatchObject({ id: c.id, createdAt: c.createdAt, updatedAt: later });
});

it('drops verification when kind or article changes, keeps it for note edits', () => {
  const v = verifyClaim(declareClaim(base));
  expect(redeclareClaim(v, { articleId: 'a', kind: 'equivalent' }).status).toBe('declared');
  expect(redeclareClaim(v, { articleId: 'b', kind: 'original' }).status).toBe('declared');
  expect(redeclareClaim(v, { articleId: 'a', kind: 'original', note: 'new' }).status).toBe('verified');
});

it('redeclaring keeps identity and createdAt, replaces kind, article and note, bumps updatedAt', () => {
  const c = declareClaim({ ...base, note: 'old' }, new Date(2026, 0, 1));
  const later = new Date(2026, 0, 2);
  const r = redeclareClaim(c, { articleId: null, kind: 'equivalent' }, later);
  expect(r).toMatchObject({ id: c.id, productId: 'p', companyId: 'c', articleId: null, kind: 'equivalent', note: null, createdAt: c.createdAt, updatedAt: later });
  expect(() => redeclareClaim(c, { articleId: 'a', kind: 'original', note: 'x'.repeat(281) })).toThrow(expect.objectContaining({ code: 'claim.note_too_long' }));
});
