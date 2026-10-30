import { expect, it } from 'vitest';
import { attachmentDisposition } from './content-disposition';

// What a response would do with it: Headers throws on a value that isn't Latin-1.
const accepted = (value: string) => new Headers({ 'Content-Disposition': value }).get('Content-Disposition');

it('names a plain file in both forms', () => {
  expect(attachmentDisposition('invoice.pdf')).toBe(`attachment; filename="invoice.pdf"; filename*=UTF-8''invoice.pdf`);
});

it('keeps a quote or backslash from ending the quoted name, and percent-encodes it in the UTF-8 form', () => {
  const value = attachmentDisposition('a"b\\c.pdf');
  expect(value).toBe(`attachment; filename="a_b_c.pdf"; filename*=UTF-8''a%22b%5Cc.pdf`);
  expect(accepted(value)).toBe(value);
});

it('carries a name outside Latin-1 in the UTF-8 form and a printable fallback in the other', () => {
  const value = attachmentDisposition('фактура 发票 😀.pdf');
  expect(value).toBe(`attachment; filename="_______ __ _.pdf"; filename*=UTF-8''%D1%84%D0%B0%D0%BA%D1%82%D1%83%D1%80%D0%B0%20%E5%8F%91%E7%A5%A8%20%F0%9F%98%80.pdf`);
  expect(accepted(value)).toBe(value);
});

it('encodes the characters RFC 5987 does not allow unescaped', () => {
  expect(attachmentDisposition(`it's (1)*.pdf`)).toContain(`filename*=UTF-8''it%27s%20%281%29%2A.pdf`);
});

it('does not trust control characters or percent signs in the fallback', () => {
  expect(attachmentDisposition('50%\r\nSet-Cookie: x.pdf')).toContain('filename="50___Set-Cookie: x.pdf"');
});

it('calls a name that is empty or only dots "evidence"', () => {
  for (const name of ['', '.', '..', '...']) expect(attachmentDisposition(name), name).toBe(`attachment; filename="evidence"; filename*=UTF-8''evidence`);
});

it('survives a lone surrogate', () => {
  expect(accepted(attachmentDisposition('a\uD800b.pdf'))).toContain('filename*=UTF-8\'\'a%EF%BF%BDb.pdf');
});
