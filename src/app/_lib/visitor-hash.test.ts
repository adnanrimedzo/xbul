import { expect, it } from 'vitest';
import { visitorHash } from './visitor-hash';

it('hashes per day, is keyed by the secret, and never contains the address', () => {
  const day1 = new Date('2026-10-30T10:00:00Z'), later = new Date('2026-10-30T23:00:00Z'), day2 = new Date('2026-10-31T01:00:00Z');
  const h = visitorHash('203.0.113.9', 's', day1)!;
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(h).not.toContain('203.0.113.9');
  expect(visitorHash('203.0.113.9', 's', later)).toBe(h);
  expect(visitorHash('203.0.113.9', 's', day2)).not.toBe(h);
  expect(visitorHash('203.0.113.9', 'other', day1)).not.toBe(h);
  expect(visitorHash(null, 's', day1)).toBeNull();
});
