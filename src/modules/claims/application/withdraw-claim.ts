import { DomainError } from '@/shared/domain/errors';
import { deleteStoredFiles } from './evidence';
import type { EvidenceDeps } from './ports';

// A brand relationship stays the mill's choice, so a mill can take back any claim of its own, verified or not.
// Its documents go with it.
export async function withdrawClaim(deps: EvidenceDeps, input: { companyId: string; claimId: string }): Promise<void> {
  const claim = await deps.claims.findById(input.claimId);
  if (!claim) throw new DomainError('claim.not_found');
  if (claim.companyId !== input.companyId) throw new DomainError('auth.forbidden');
  const files = await deps.evidence.listByClaim(claim.id);
  await deps.claims.delete(claim.id); // the rows go with the claim
  await deleteStoredFiles(deps.store, files);
}
