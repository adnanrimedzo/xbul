import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { articles, companies } from '@/modules/supplier';
import { tileColumns, toTile } from './garment-tiles';
import type { ArticlePageView } from './types';

export async function getArticlePageView(db: Db, companySlug: string, articleSlug: string): Promise<ArticlePageView | null> {
  const [row] = await db
    .select({ company: companies, article: articles })
    .from(companies)
    .innerJoin(articles, eq(articles.companyId, companies.id))
    .where(and(eq(companies.slug, companySlug), eq(articles.slug, articleSlug)))
    .limit(1);
  if (!row) return null;
  const { company: c, article: a } = row;

  const garments = await db
    .select({ ...tileColumns, kind: claims.kind })
    .from(claims)
    .innerJoin(products, eq(claims.productId, products.id))
    .where(eq(claims.articleId, a.id))
    .orderBy(desc(claims.createdAt));

  return {
    company: { id: c.id, slug: c.slug, name: c.name, city: c.city, country: c.country, ownerUserId: c.ownerUserId },
    article: {
      id: a.id,
      slug: a.slug,
      code: a.code,
      specs: { weightOz: a.weightOz, composition: a.composition, finish: a.finish, moqMeters: a.moqMeters, leadTimeWeeks: a.leadTimeWeeks },
    },
    garments: garments.map(({ kind, ...tile }) => toTile(tile, kind)),
  };
}
