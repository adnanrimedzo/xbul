import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claims, rankClaims, type ClaimKind, type ClaimStatus } from '@/modules/claims';
import { articles, companies } from '@/modules/supplier';
import type { ClaimView, ProductPageView } from './types';

export async function getProductPageView(db: Db, productId: string): Promise<ProductPageView | null> {
  const [p] = await db
    .select({ id: products.id, brand: products.brand, name: products.name, imageUrl: products.imageUrl, composition: products.composition, sourceUrl: products.sourceUrl })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!p) return null;

  const rows = await db
    .select({ claim: claims, company: companies, article: articles })
    .from(claims)
    .innerJoin(companies, eq(claims.companyId, companies.id))
    .leftJoin(articles, eq(claims.articleId, articles.id))
    .where(eq(claims.productId, productId));

  const views: ClaimView[] = rows.map(({ claim, company, article }) => ({
    claimId: claim.id,
    kind: claim.kind as ClaimKind,
    status: claim.status as ClaimStatus,
    note: claim.note,
    createdAt: claim.createdAt,
    company: {
      id: company.id,
      slug: company.slug,
      name: company.name,
      city: company.city,
      country: company.country,
      contact: { email: company.contactEmail, phone: company.contactPhone, website: company.website },
    },
    article: article && {
      id: article.id,
      slug: article.slug,
      code: article.code,
      specs: { weightOz: article.weightOz, composition: article.composition, finish: article.finish, moqMeters: article.moqMeters, leadTimeWeeks: article.leadTimeWeeks },
    },
  }));

  const ranked = rankClaims(views);
  return { product: p, originals: ranked.filter((c) => c.kind === 'original'), equivalents: ranked.filter((c) => c.kind === 'equivalent') };
}
