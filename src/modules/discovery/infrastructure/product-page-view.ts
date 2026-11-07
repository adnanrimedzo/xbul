import { and, eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { ProductTypeId } from '@/shared/domain/taxonomy';
import { products } from '@/modules/catalog';
import { claims, rankClaims, type ClaimKind, type ClaimScope, type ClaimStatus } from '@/modules/claims';
import { articles, companies, type CompanyKind } from '@/modules/supplier';
import type { ClaimGroup, ClaimView, ProductPageView } from './types';

export async function getProductPageView(db: Db, productId: string): Promise<ProductPageView | null> {
  const [p] = await db
    .select({ id: products.id, brand: products.brand, name: products.name, imageUrl: products.imageUrl, composition: products.composition, sourceUrl: products.sourceUrl, type: products.type })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!p) return null;

  const rows = await db
    .select({ claim: claims, company: companies, article: articles })
    .from(claims)
    .innerJoin(companies, eq(claims.companyId, companies.id))
    .leftJoin(articles, eq(claims.articleId, articles.id))
    .where(and(eq(claims.productId, productId), eq(companies.status, 'approved')));
  if (rows.length === 0) return null; // nothing public yet, even for the owner of the only claim

  const toView = ({ claim, company, article }: (typeof rows)[number]): ClaimView => ({
    claimId: claim.id,
    kind: claim.kind as ClaimKind,
    status: claim.status as ClaimStatus,
    note: claim.note,
    createdAt: claim.createdAt,
    company: {
      id: company.id,
      slug: company.slug,
      name: company.name,
      kind: company.kind as CompanyKind,
      city: company.city,
      country: company.country,
      contact: { email: company.contactEmail, phone: company.contactPhone, website: company.website },
    },
    article: article && {
      id: article.id,
      slug: article.slug,
      code: article.code,
      specs: { weight: article.weight, composition: article.composition, finish: article.finish, moq: article.moq, leadTimeWeeks: article.leadTimeWeeks },
      fabric: article.fabric,
    },
  });

  const group = (scope: ClaimScope): ClaimGroup => {
    const ranked = rankClaims(rows.filter((r) => r.claim.scope === scope).map(toView));
    return { originals: ranked.filter((c) => c.kind === 'original'), equivalents: ranked.filter((c) => c.kind === 'equivalent') };
  };
  return { product: { ...p, type: p.type as ProductTypeId | null }, fabric: group('fabric'), garment: group('garment') };
}
