import { DomainError } from '@/shared/domain/errors';
import { declareClaim, redeclareClaim, type Claim, type ClaimKind } from '../domain/claim';
import type { ClaimRepository } from '../domain/repositories';

export type GarmentItem = { productId: string; articleCode: string | null; kind: ClaimKind; note?: string | null };

const MAX_BATCH = 50;

// Returns one claim per distinct product, in the order of each product's last occurrence in `items`.
// Every item is validated and built before anything is saved, so an invalid item saves no claims.
export async function publishGarments(
  deps: {
    claims: ClaimRepository;
    getProduct: (id: string) => Promise<{ id: string } | null>;
    upsertArticle: (input: { companyId: string; code: string }) => Promise<{ id: string }>;
  },
  input: { companyId: string; items: readonly GarmentItem[] },
): Promise<Claim[]> {
  if (input.items.length < 1 || input.items.length > MAX_BATCH) throw new DomainError('claims.batch_size_invalid');

  const byProduct = new Map<string, GarmentItem>();
  for (const item of input.items) {
    byProduct.delete(item.productId);
    byProduct.set(item.productId, item);
  }

  const built: Claim[] = [];
  for (const item of byProduct.values()) {
    if (!(await deps.getProduct(item.productId))) throw new DomainError('product.not_found');
    const code = item.articleCode?.trim();
    const articleId = code ? (await deps.upsertArticle({ companyId: input.companyId, code })).id : null;
    const fields = { articleId, kind: item.kind, note: item.note };
    const existing = await deps.claims.findByProductAndCompany(item.productId, input.companyId);
    built.push(existing ? redeclareClaim(existing, fields) : declareClaim({ productId: item.productId, companyId: input.companyId, ...fields }));
  }
  for (const claim of built) await deps.claims.save(claim);
  return built;
}
