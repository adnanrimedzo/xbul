import { expect, it } from 'vitest';
import type { ClaimKind, ClaimStatus } from './claim';
import { rankClaims } from './rank-claims';

it('orders verified original, declared originals, equivalents — oldest first within a group', () => {
  const t = (n: number) => new Date(2026, 0, n);
  const c = (id: string, kind: ClaimKind, status: ClaimStatus, day: number) => ({ id, kind, status, createdAt: t(day) });
  const ranked = rankClaims([c('e1', 'equivalent', 'declared', 1), c('o3', 'original', 'declared', 3), c('v5', 'original', 'verified', 5), c('o2', 'original', 'declared', 2), c('e0', 'equivalent', 'declared', 0)]);
  expect(ranked.map(x => x.id)).toEqual(['v5', 'o2', 'o3', 'e0', 'e1']);
});

it('returns a new array and leaves the input untouched', () => {
  const input = [
    { id: 'b', kind: 'equivalent' as const, status: 'declared' as const, createdAt: new Date(2026, 0, 2) },
    { id: 'a', kind: 'original' as const, status: 'declared' as const, createdAt: new Date(2026, 0, 1) },
  ];
  const ranked = rankClaims(input);
  expect(ranked).not.toBe(input);
  expect(input.map(x => x.id)).toEqual(['b', 'a']);
});
