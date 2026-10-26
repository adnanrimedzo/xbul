import { DomainError } from '@/shared/domain/errors';
import type { ClaimRepository } from '../domain/repositories';

// A brand relationship stays the mill's choice, so a mill can take back any claim of its own, verified or not.
export async function withdrawClaim(deps: { claims: ClaimRepository }, input: { companyId: string; claimId: string }): Promise<void> {
  const claim = await deps.claims.findById(input.claimId);
  if (!claim) throw new DomainError('claim.not_found');
  if (claim.companyId !== input.companyId) throw new DomainError('auth.forbidden');
  await deps.claims.delete(claim.id);
}
