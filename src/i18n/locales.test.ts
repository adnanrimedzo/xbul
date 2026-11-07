import { expect, test } from 'vitest';
import { errorMessage } from '@/app/_lib/error-messages';
import { hasLocale, localePath, stripLocale } from './locales';

test('English is the bare path and Turkish lives under /tr', () => {
  expect(localePath('en', '/p/1')).toBe('/p/1');
  expect(localePath('tr', '/p/1')).toBe('/tr/p/1');
  expect(localePath('tr', '/')).toBe('/tr');
  expect(stripLocale('/tr/p/1')).toBe('/p/1');
  expect(stripLocale('/tr')).toBe('/');
  expect(stripLocale('/trousers')).toBe('/trousers');
  expect(hasLocale('tr') && !hasLocale('de')).toBe(true);
});

test('every error has a Turkish sentence of its own', () => {
  for (const code of ['generic', 'product.url_invalid', 'evidence.too_large', 'company.contact_required']) {
    expect(errorMessage(code, 'tr')).not.toBe(errorMessage(code, 'en'));
  }
  expect(errorMessage('no.such_code', 'tr')).toBe(errorMessage('generic', 'tr'));
});
