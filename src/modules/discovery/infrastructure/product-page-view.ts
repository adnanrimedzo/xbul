import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { PARTS, type ProductTypeId } from '@/shared/domain/taxonomy';
import { products } from '@/modules/catalog';
import { claims, rankClaims, type ClaimKind, type ClaimStatus } from '@/modules/claims';
import { articles, companies, type CompanyKind, type CompanyStatus } from '@/modules/supplier';
import type { ClaimView, ProductPageView } from './types';
import { canSeeCompany } from './visibility';

// A visitor (null viewer) sees only approved companies' claims; an unapproved company's owner and the admins see its claims too.
export async function getProductPageView(db: Db, productId: string, viewer: { userId: string; isAdmin: boolean } | null = null): Promise<ProductPageView | null> {
  const [p] = await db
    .select({ id: products.id, brand: products.brand, name: products.name, imageUrl: products.imageUrl, composition: products.composition, sourceUrl: products.sourceUrl, type: products.type })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!p) return null;

  const rows = (
    await db
      .select({ claim: claims, company: companies, article: articles })
      .from(claims)
      .innerJoin(companies, eq(claims.companyId, companies.id))
      .leftJoin(articles, eq(claims.articleId, articles.id))
      .where(eq(claims.productId, productId))
  ).filter(({ company }) => canSeeCompany({ status: company.status as CompanyStatus, ownerUserId: company.ownerUserId }, viewer));
  if (rows.length === 0) return null; // no claim this viewer may see

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

  const parts = PARTS.flatMap(({ id, full }) => {
    const ranked = rankClaims(rows.filter((r) => r.claim.scope === id).map(toView));
    return ranked.length === 0 ? [] : [{ part: id, full, originals: ranked.filter((c) => c.kind === 'original'), equivalents: ranked.filter((c) => c.kind === 'equivalent') }];
  });
  return { product: { ...p, type: p.type as ProductTypeId | null }, parts };
}
