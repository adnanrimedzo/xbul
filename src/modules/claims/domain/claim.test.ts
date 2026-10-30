import { expect, it } from 'vitest';
import { approveReview, declareClaim, redeclareClaim, rejectReview, submitForReview, verifyClaim } from './claim';

const base = { productId: 'p', companyId: 'c', articleId: 'a', kind: 'original' as const, scope: 'fabric' as const };

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
  expect(c).toMatchObject({ ...base, status: 'declared', reviewStatus: 'none', reviewNote: null, reviewedBy: null, reviewedAt: null, createdAt: now, updatedAt: now });
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

it('keeps the scope when a claim is redeclared', () => {
  const c = declareClaim({ ...base, scope: 'garment' });
  expect(c.scope).toBe('garment');
  expect(redeclareClaim(c, { articleId: null, kind: 'equivalent' }).scope).toBe('garment');
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
  expect(r).toMatchObject({ id: c.id, productId: 'p', companyId: 'c', scope: 'fabric', articleId: null, kind: 'equivalent', note: null, createdAt: c.createdAt, updatedAt: later });
  expect(() => redeclareClaim(c, { articleId: 'a', kind: 'original', note: 'x'.repeat(281) })).toThrow(expect.objectContaining({ code: 'claim.note_too_long' }));
});

it('moves through review', () => {
  const claim = declareClaim(base);
  const pending = submitForReview(claim);
  expect(pending.reviewStatus).toBe('pending');
  expect(() => submitForReview(pending)).toThrow(expect.objectContaining({ code: 'claim.already_in_review' }));
  const approved = approveReview(pending, 'admin1');
  expect(approved).toMatchObject({ status: 'verified', reviewStatus: 'none', reviewedBy: 'admin1' });
  const rejected = rejectReview(pending, 'admin1', ' Invoice is unreadable ');
  expect(rejected).toMatchObject({ status: 'declared', reviewStatus: 'rejected', reviewNote: 'Invoice is unreadable' });
  expect(() => rejectReview(pending, 'admin1', ' ')).toThrow(expect.objectContaining({ code: 'claim.review_note_invalid' }));
  expect(() => approveReview(claim, 'admin1')).toThrow(expect.objectContaining({ code: 'claim.not_in_review' }));
  expect(() => submitForReview(declareClaim({ ...base, kind: 'equivalent' }))).toThrow(expect.objectContaining({ code: 'claim.only_original_verifiable' }));
});

it('a changed fact cancels a pending review', () =>
  expect(redeclareClaim(submitForReview(declareClaim(base)), { articleId: 'b', kind: 'original' }).reviewStatus).toBe('none'));

it('an unchanged fact keeps a pending review, whatever the note says', () =>
  expect(redeclareClaim(submitForReview(declareClaim(base)), { articleId: 'a', kind: 'original', note: 'new' }).reviewStatus).toBe('pending'));

it('a verified claim can’t go back to review, and a rejected one can try again', () => {
  expect(() => submitForReview(verifyClaim(declareClaim(base)))).toThrow(expect.objectContaining({ code: 'claim.already_verified_original' }));
  const rejected = rejectReview(submitForReview(declareClaim(base)), 'admin1', 'Unreadable');
  expect(submitForReview(rejected).reviewStatus).toBe('pending');
});

it('records who decided and when, and clears an earlier rejection note on approval', () => {
  const at = new Date(2026, 0, 3);
  const rejected = rejectReview(submitForReview(declareClaim(base)), 'admin1', 'Unreadable', new Date(2026, 0, 2));
  expect(rejected).toMatchObject({ reviewedBy: 'admin1', reviewedAt: new Date(2026, 0, 2) });
  const approved = approveReview(submitForReview(rejected), 'admin2', at);
  expect(approved).toMatchObject({ id: rejected.id, createdAt: rejected.createdAt, updatedAt: at, reviewedBy: 'admin2', reviewedAt: at, reviewNote: null });
});

it('rejects a note longer than 500 characters', () => {
  const pending = submitForReview(declareClaim(base));
  expect(rejectReview(pending, 'admin1', 'x'.repeat(500)).reviewNote).toHaveLength(500);
  expect(() => rejectReview(pending, 'admin1', 'x'.repeat(501))).toThrow(expect.objectContaining({ code: 'claim.review_note_invalid' }));
});
