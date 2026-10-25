import { and, eq, type SQL } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { Article } from '../domain/article';
import type { Company } from '../domain/company';
import type { ArticleRepository, CompanyRepository } from '../domain/repositories';
import { articles, companies } from './schema';

const toCompany = (r: typeof companies.$inferSelect): Company =>
  Object.freeze({ id: r.id, slug: r.slug, name: r.name, kind: 'fabric_mill', city: r.city, country: r.country, ownerUserId: r.ownerUserId, createdAt: r.createdAt });

const toArticle = (r: typeof articles.$inferSelect): Article =>
  Object.freeze({
    id: r.id,
    companyId: r.companyId,
    code: r.code,
    slug: r.slug,
    specs: Object.freeze({ weightOz: r.weightOz, composition: r.composition, finish: r.finish, moqMeters: r.moqMeters, leadTimeWeeks: r.leadTimeWeeks }),
    createdAt: r.createdAt,
  });

export function createSupplierRepositories(db: Db): { companies: CompanyRepository; articles: ArticleRepository } {
  const companyBy = async (where: SQL) => {
    const [row] = await db.select().from(companies).where(where).limit(1);
    return row ? toCompany(row) : null;
  };
  const articleBy = async (where: SQL | undefined) => {
    const [row] = await db.select().from(articles).where(where).limit(1);
    return row ? toArticle(row) : null;
  };

  return {
    companies: {
      async save(c) {
        await db.insert(companies).values(c).onConflictDoUpdate({ target: companies.id, set: c });
      },
      findById: (id) => companyBy(eq(companies.id, id)),
      findBySlug: (slug) => companyBy(eq(companies.slug, slug)),
      findByOwner: (userId) => companyBy(eq(companies.ownerUserId, userId)),
      async slugExists(slug) {
        return (await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1)).length > 0;
      },
    },
    articles: {
      async save(a) {
        const { specs, ...rest } = a;
        const row = { ...rest, ...specs };
        await db.insert(articles).values(row).onConflictDoUpdate({ target: articles.id, set: row });
      },
      findById: (id) => articleBy(eq(articles.id, id)),
      findByCode: (companyId, code) => articleBy(and(eq(articles.companyId, companyId), eq(articles.code, code))),
      async slugExists(companyId, slug) {
        const rows = await db.select({ id: articles.id }).from(articles).where(and(eq(articles.companyId, companyId), eq(articles.slug, slug))).limit(1);
        return rows.length > 0;
      },
    },
  };
}
