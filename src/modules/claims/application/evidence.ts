import { DomainError } from '@/shared/domain/errors';
import { approveReview, assertCanEditEvidence, rejectReview, submitForReview, type Claim } from '../domain/claim';
import { createEvidence, MAX_EVIDENCE_FILES, type Evidence } from '../domain/evidence';
import type { EvidenceDeps, EvidenceStore } from './ports';

async function findClaim(deps: EvidenceDeps, claimId: string): Promise<Claim> {
  const claim = await deps.claims.findById(claimId);
  if (!claim) throw new DomainError('claim.not_found');
  return claim;
}

async function ownedClaim(deps: EvidenceDeps, companyId: string, claimId: string): Promise<Claim> {
  const claim = await findClaim(deps, claimId);
  if (claim.companyId !== companyId) throw new DomainError('auth.forbidden');
  return claim;
}

// A file that can't be deleted is logged, with its key so it can be cleaned up by hand, and never fails what
// called this: the decision or withdrawal it follows has already happened.
export async function deleteStoredFiles(store: EvidenceStore, files: readonly Evidence[]): Promise<void> {
  for (const file of files) {
    try {
      await store.delete(file.storageKey);
    } catch (e) {
      console.error(`[evidence] could not delete ${file.storageKey}`, e);
    }
  }
}

export async function addEvidence(
  deps: EvidenceDeps,
  input: { companyId: string; claimId: string; fileName: string; bytes: Uint8Array },
): Promise<Evidence> {
  const claim = await ownedClaim(deps, input.companyId, input.claimId);
  assertCanEditEvidence(claim);
  const evidence = createEvidence({ claimId: claim.id, fileName: input.fileName, bytes: input.bytes });
  if ((await deps.evidence.listByClaim(claim.id)).length >= MAX_EVIDENCE_FILES) throw new DomainError('evidence.too_many');
  await deps.store.put(evidence.storageKey, input.bytes, evidence.contentType);
  try {
    await deps.evidence.save(evidence);
  } catch (e) {
    await deleteStoredFiles(deps.store, [evidence]); // no row will ever point at these bytes
    throw e;
  }
  return evidence;
}

// A file that isn't the caller's is reported as missing, so the answer doesn't confirm that an id exists.
export async function removeEvidence(deps: EvidenceDeps, input: { companyId: string; evidenceId: string }): Promise<void> {
  const evidence = await deps.evidence.findById(input.evidenceId);
  const claim = evidence && (await deps.claims.findById(evidence.claimId));
  if (!evidence || !claim || claim.companyId !== input.companyId) throw new DomainError('evidence.not_found');
  assertCanEditEvidence(claim);
  await deps.evidence.delete(evidence.id);
  await deleteStoredFiles(deps.store, [evidence]);
}

export async function submitClaimForReview(deps: EvidenceDeps, input: { companyId: string; claimId: string }): Promise<Claim> {
  const pending = submitForReview(await ownedClaim(deps, input.companyId, input.claimId));
  if ((await deps.evidence.listByClaim(pending.id)).length === 0) throw new DomainError('evidence.required');
  await deps.claims.save(pending);
  return pending;
}

// Only an admin or the supplier that owns the claim gets the bytes. Anyone else, and any id that doesn't exist, gets null.
export async function readEvidence(
  deps: EvidenceDeps,
  input: { evidenceId: string; viewer: { isAdmin: boolean; companyId: string | null } },
): Promise<{ evidence: Evidence; bytes: Uint8Array } | null> {
  const evidence = await deps.evidence.findById(input.evidenceId);
  if (!evidence) return null;
  if (!input.viewer.isAdmin) {
    const claim = await deps.claims.findById(evidence.claimId);
    if (!claim || input.viewer.companyId === null || claim.companyId !== input.viewer.companyId) return null;
  }
  const bytes = await deps.store.get(evidence.storageKey);
  return bytes ? { evidence, bytes } : null;
}

// A decision is saved first; only then do the rows and the files go. What stays is the decision, who made it and when.
async function settle(deps: EvidenceDeps, decided: Claim): Promise<void> {
  const files = await deps.evidence.listByClaim(decided.id);
  await deps.claims.save(decided);
  await deps.evidence.deleteByClaim(decided.id);
  await deleteStoredFiles(deps.store, files);
}

export async function approveClaimReview(deps: EvidenceDeps, input: { claimId: string; adminUserId: string }): Promise<Claim> {
  const claim = await findClaim(deps, input.claimId);
  const approved = approveReview(claim, input.adminUserId);
  const current = await deps.claims.findVerifiedOriginal(claim.productId, claim.scope);
  if (current && current.id !== claim.id) throw new DomainError('claim.already_verified_original');
  await settle(deps, approved);
  return approved;
}

export async function rejectClaimReview(deps: EvidenceDeps, input: { claimId: string; adminUserId: string; note: string }): Promise<Claim> {
  const rejected = rejectReview(await findClaim(deps, input.claimId), input.adminUserId, input.note);
  await settle(deps, rejected);
  return rejected;
}
