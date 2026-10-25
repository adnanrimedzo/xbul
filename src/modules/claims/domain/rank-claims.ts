import type { Claim } from './claim';

// 0 = verified original, 1 = declared original, 2 = equivalent.
const tier = (c: Pick<Claim, 'kind' | 'status'>): number => (c.kind === 'equivalent' ? 2 : c.status === 'verified' ? 0 : 1);

export function rankClaims<T extends Pick<Claim, 'kind' | 'status' | 'createdAt'>>(claims: readonly T[]): T[] {
  return [...claims].sort((a, b) => tier(a) - tier(b) || a.createdAt.getTime() - b.createdAt.getTime());
}
