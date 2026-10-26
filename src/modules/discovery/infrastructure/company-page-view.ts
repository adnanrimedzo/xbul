import { asc, count, desc, eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { articles, companies } from '@/modules/supplier';
import { tileColumns, toTile } from './garment-tiles';
import type { CompanyPageView } from './types';

export async function getCompanyPageView(db: Db, companySlug: string): Promise<CompanyPageView | null> {
  const [c] = await db.select().from(companies).where(eq(companies.slug, companySlug)).limit(1);
  if (!c) return null;

  const articleRows = await db
    .select({ slug: articles.slug, code: articles.code, garmentCount: count(claims.id) })
    .from(articles)
    .leftJoin(claims, eq(claims.articleId, articles.id))
    .where(eq(articles.companyId, c.id))
    .groupBy(articles.id)
    .orderBy(asc(articles.code));

  const garments = await db
    .select({ ...tileColumns, kind: claims.kind, claimId: claims.id })
    .from(claims)
    .innerJoin(products, eq(claims.productId, products.id))
    .where(eq(claims.companyId, c.id))
    .orderBy(desc(claims.createdAt));

  return {
    company: { id: c.id, slug: c.slug, name: c.name, city: c.city, country: c.country, ownerUserId: c.ownerUserId },
    articles: articleRows,
    garments: garments.map(({ kind, claimId, ...tile }) => ({ ...toTile(tile, kind), claimId })),
  };
}
