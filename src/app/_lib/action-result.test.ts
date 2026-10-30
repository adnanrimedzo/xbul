import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DomainError } from '@/shared/domain/errors';
import { toActionError } from './action-result';
import { errorMessage } from './error-messages';

const FALLBACK = 'Something went wrong. Please try again.';

describe('toActionError', () => {
  it('maps domain errors to copy and rethrows the rest', () => {
    expect(toActionError(new DomainError('company.name_invalid'))).toEqual({ ok: false, error: 'Company name must be 2–80 characters.' });
    expect(toActionError(new DomainError('unknown.code'))).toEqual({ ok: false, error: FALLBACK });
    expect(() => toActionError(new Error('boom'))).toThrow('boom');
  });

  it('has copy for every error code thrown under src/', () => {
    // Codes reach DomainError directly or through helpers (article.moq_invalid), so collect every dotted
    // string literal in non-test files that use DomainError.
    const codes = new Set<string>();
    for (const file of readdirSync('src', { recursive: true, encoding: 'utf8' })) {
      if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      const source = readFileSync(join('src', file), 'utf8');
      if (!source.includes('DomainError(')) continue;
      for (const [, code] of source.matchAll(/'([a-z_]+\.[a-z_]+)'/g)) codes.add(code!);
    }
    expect(codes.size).toBeGreaterThan(15);
    expect([...codes].filter((code) => errorMessage(code) === FALLBACK)).toEqual([]);
  });
});
