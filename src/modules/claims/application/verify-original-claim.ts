import { DomainError } from '@/shared/domain/errors';
import { verifyClaim, type Claim } from '../domain/claim';
import type { ClaimRepository } from '../domain/repositories';

export async function verifyOriginalClaim(deps: { claims: ClaimRepository }, claimId: string): Promise<Claim> {
  const claim = await deps.claims.findById(claimId);
  if (!claim) throw new DomainError('claim.not_found');
  const verified = verifyClaim(claim);
  const current = await deps.claims.findVerifiedOriginal(claim.productId, claim.scope);
  if (current && current.id !== claim.id) throw new DomainError('claim.already_verified_original');
  await deps.claims.save(verified);
  return verified;
}
