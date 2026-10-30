import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';

export type ClaimKind = 'original' | 'equivalent';
export type ClaimStatus = 'declared' | 'verified';
// Which side of the product the claiming company made: the fabric or the garment.
export type ClaimScope = 'fabric' | 'garment';

export type Claim = Readonly<{
  id: string;
  productId: string;
  companyId: string;
  articleId: string | null;
  kind: ClaimKind;
  scope: ClaimScope;
  status: ClaimStatus;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

const NOTE_MAX = 280;

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
    createdAt: now,
    updatedAt: now,
  });
}

// A redeclaration restates the whole claim: an absent note clears it. Verification survives only
// if the verified fact (kind + article) is unchanged.
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
    updatedAt: now,
  });
}

export function verifyClaim(claim: Claim, now: Date = new Date()): Claim {
  if (claim.kind !== 'original') throw new DomainError('claim.only_original_verifiable');
  return Object.freeze({ ...claim, status: 'verified', updatedAt: now });
}
