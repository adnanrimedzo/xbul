import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';

export type ClaimKind = 'original' | 'equivalent';
export type ClaimStatus = 'declared' | 'verified';
// Which side of the product the claiming company made: the fabric or the garment.
export type ClaimScope = 'fabric' | 'garment';
// Where an original's proof stands: not sent, waiting for an admin, or sent back with a note.
export type ReviewStatus = 'none' | 'pending' | 'rejected';

export type Claim = Readonly<{
  id: string;
  productId: string;
  companyId: string;
  articleId: string | null;
  kind: ClaimKind;
  scope: ClaimScope;
  status: ClaimStatus;
  note: string | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

const NOTE_MAX = 280;
const REVIEW_NOTE_MAX = 500;

const normalizeNote = (raw: string | null | undefined): string | null => {
  const note = raw?.trim() ?? '';
  if (note.length > NOTE_MAX) throw new DomainError('claim.note_too_long');
  return note || null;
};

export function declareClaim(
  input: { productId: string; companyId: string; articleId: string | null; kind: ClaimKind; scope: ClaimScope; note?: string | null },
  now: Date = new Date(),
): Claim {
  return Object.freeze({
    id: newId(),
    productId: input.productId,
    companyId: input.companyId,
    articleId: input.articleId,
    kind: input.kind,
    scope: input.scope,
    status: 'declared',
    note: normalizeNote(input.note),
    reviewStatus: 'none',
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

// A redeclaration restates the whole claim: an absent note clears it. Verification and a pending review
// survive only if the claimed fact (kind + article) is unchanged.
export function redeclareClaim(
  claim: Claim,
  input: { articleId: string | null; kind: ClaimKind; note?: string | null },
  now: Date = new Date(),
): Claim {
  const note = normalizeNote(input.note);
  const sameFact = input.kind === claim.kind && input.articleId === claim.articleId;
  return Object.freeze({
    ...claim,
    articleId: input.articleId,
    kind: input.kind,
    note,
    status: claim.status === 'verified' && sameFact ? 'verified' : 'declared',
    reviewStatus: claim.reviewStatus === 'pending' && !sameFact ? 'none' : claim.reviewStatus,
    updatedAt: now,
  });
}

export function verifyClaim(claim: Claim, now: Date = new Date()): Claim {
  if (claim.kind !== 'original') throw new DomainError('claim.only_original_verifiable');
  return Object.freeze({ ...claim, status: 'verified', updatedAt: now });
}

// Only a declared original that isn't already with an admin can have its documents changed or be sent in.
export function assertCanEditEvidence(claim: Claim): void {
  if (claim.kind !== 'original') throw new DomainError('claim.only_original_verifiable');
  if (claim.status === 'verified') throw new DomainError('claim.already_verified_original');
  if (claim.reviewStatus === 'pending') throw new DomainError('claim.already_in_review');
}

export function submitForReview(claim: Claim, now: Date = new Date()): Claim {
  assertCanEditEvidence(claim);
  return Object.freeze({ ...claim, reviewStatus: 'pending', updatedAt: now });
}

function assertInReview(claim: Claim): void {
  if (claim.reviewStatus !== 'pending') throw new DomainError('claim.not_in_review');
}

// A decision keeps who made it and when. An approval verifies the claim; a rejection leaves it declared, with the reason.
export function approveReview(claim: Claim, adminUserId: string, now: Date = new Date()): Claim {
  assertInReview(claim);
  return Object.freeze({ ...claim, status: 'verified', reviewStatus: 'none', reviewNote: null, reviewedBy: adminUserId, reviewedAt: now, updatedAt: now });
}

export function rejectReview(claim: Claim, adminUserId: string, note: string, now: Date = new Date()): Claim {
  assertInReview(claim);
  const reviewNote = note.trim();
  if (reviewNote.length < 1 || reviewNote.length > REVIEW_NOTE_MAX) throw new DomainError('claim.review_note_invalid');
  return Object.freeze({ ...claim, reviewStatus: 'rejected', reviewNote, reviewedBy: adminUserId, reviewedAt: now, updatedAt: now });
}
