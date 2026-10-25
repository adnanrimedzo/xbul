import { expect, it } from 'vitest';
import { createInquiry, markAnswered } from './inquiry';

const ok = { companyId: 'c', productId: 'p', articleId: null, kind: 'swatch' as const, buyerName: 'Ana Buyer', buyerEmail: ' Ana@Brand.TEST ', viaAgentHandle: null };

it('normalizes email and defaults optional fields', () =>
  expect(createInquiry(ok)).toMatchObject({ buyerEmail: 'ana@brand.test', buyerCompany: null, quantityMeters: null, message: null, status: 'new' }));

it('creates a frozen inquiry stamped with the given time', () => {
  const now = new Date(2026, 0, 1);
  const i = createInquiry(ok, now);
  expect(i.createdAt).toBe(now);
  expect(Object.isFrozen(i)).toBe(true);
});

it('trims the optional text fields and treats blanks as absent', () => {
  expect(createInquiry({ ...ok, buyerName: '  Ana ', buyerCompany: ' Brand Co ', message: ' hi ' })).toMatchObject({ buyerName: 'Ana', buyerCompany: 'Brand Co', message: 'hi' });
  expect(createInquiry({ ...ok, buyerCompany: '  ', message: '  ' })).toMatchObject({ buyerCompany: null, message: null });
});

it('accepts articleId alone and the boundary values', () => {
  expect(createInquiry({ ...ok, productId: null, articleId: 'a' })).toMatchObject({ productId: null, articleId: 'a' });
  expect(createInquiry({ ...ok, buyerName: 'x'.repeat(100), buyerCompany: 'x'.repeat(120), message: 'x'.repeat(2000), quantityMeters: 1_000_000 }).quantityMeters).toBe(1_000_000);
  expect(createInquiry({ ...ok, quantityMeters: 1 }).quantityMeters).toBe(1);
});

it('caps the email at 254 characters after normalization', () => {
  const email = (n: number) => `${'a'.repeat(n - '@x.test'.length)}@x.test`;
  expect(createInquiry({ ...ok, buyerEmail: email(254) }).buyerEmail).toHaveLength(254);
  expect(() => createInquiry({ ...ok, buyerEmail: email(255) })).toThrow(expect.objectContaining({ code: 'inquiry.email_invalid' }));
  expect(createInquiry({ ...ok, buyerEmail: `  ${email(254).toUpperCase()}  ` }).buyerEmail).toHaveLength(254);
});

it.each([
  [{ buyerEmail: 'not-an-email' }, 'inquiry.email_invalid'], [{ buyerName: '' }, 'inquiry.name_invalid'],
  [{ buyerName: ' ' }, 'inquiry.name_invalid'], [{ buyerName: 'x'.repeat(101) }, 'inquiry.name_invalid'],
  [{ buyerCompany: 'x'.repeat(121) }, 'inquiry.company_invalid'],
  [{ productId: null }, 'inquiry.target_required'], [{ quantityMeters: 0 }, 'inquiry.quantity_invalid'],
  [{ quantityMeters: 1.5 }, 'inquiry.quantity_invalid'], [{ quantityMeters: 1_000_001 }, 'inquiry.quantity_invalid'],
  [{ message: 'x'.repeat(2001) }, 'inquiry.message_too_long'],
])('rejects %j', (patch, code) => expect(() => createInquiry({ ...ok, ...patch })).toThrow(expect.objectContaining({ code })));

it('marks answered without touching anything else', () => {
  const i = createInquiry(ok);
  const answered = markAnswered(i);
  expect(answered).toEqual({ ...i, status: 'answered' });
  expect(Object.isFrozen(answered)).toBe(true);
});
