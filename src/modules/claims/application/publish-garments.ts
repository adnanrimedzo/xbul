import { DomainError } from '@/shared/domain/errors';
import { declareClaim, redeclareClaim, sameClaimedFact, type Claim, type ClaimKind, type ClaimScope } from '../domain/claim';
import { purgeEvidence } from './evidence';
import type { EvidenceDeps } from './ports';

export type GarmentItem = { productId: string; articleCode: string | null; kind: ClaimKind; note?: string | null };

const MAX_BATCH = 50;

// Returns one claim per distinct product, in the order of each product's last occurrence in `items`.
// Every item is validated and built before anything is saved, so an invalid item saves no claims.
// A claim whose kind or product code changed no longer matches the documents sent for it, so those are deleted.
export async function publishGarments(
  deps: EvidenceDeps & {
    getProduct: (id: string) => Promise<{ id: string } | null>;
    upsertArticle: (input: { companyId: string; code: string }) => Promise<{ id: string }>;
  },
  input: { companyId: string; scope: ClaimScope; items: readonly GarmentItem[] },
): Promise<Claim[]> {
  if (input.items.length < 1 || input.items.length > MAX_BATCH) throw new DomainError('claims.batch_size_invalid');

  const byProduct = new Map<string, GarmentItem>();
  for (const item of input.items) {
    byProduct.delete(item.productId);
    byProduct.set(item.productId, item);
  }

  const built: Claim[] = [];
  const factChanged = new Set<string>();
  for (const item of byProduct.values()) {
    if (!(await deps.getProduct(item.productId))) throw new DomainError('product.not_found');
    const code = item.articleCode?.trim();
    const articleId = code ? (await deps.upsertArticle({ companyId: input.companyId, code })).id : null;
    const fields = { articleId, kind: item.kind, note: item.note };
    const existing = await deps.claims.findByProductAndCompany(item.productId, input.companyId);
    const claim = existing ? redeclareClaim(existing, fields) : declareClaim({ productId: item.productId, companyId: input.companyId, scope: input.scope, ...fields });
    if (existing && !sameClaimedFact(existing, claim)) factChanged.add(claim.id);
    built.push(claim);
  }
  for (const claim of built) {
    const files = factChanged.has(claim.id) ? await deps.evidence.listByClaim(claim.id) : [];
    await deps.claims.save(claim);
    if (files.length > 0) await purgeEvidence(deps, claim.id, files);
  }
  return built;
}
