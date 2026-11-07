import { and, asc, eq, inArray, ne, type SQL } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { Article } from '../domain/article';
import type { Company, CompanyKind, CompanyStatus } from '../domain/company';
import type { Registration, ReviewAction, ReviewEvent } from '../domain/registration';
import type { CompanyDocument } from '../domain/company-document';
import type { ArticleRepository, CompanyDocumentRepository, CompanyRepository, RegistrationRepository, ReviewEventRepository } from '../domain/repositories';
import { articles, companies, companyDocuments, companyRegistrations, companyReviewEvents } from './schema';

const toDocument = (r: typeof companyDocuments.$inferSelect): CompanyDocument => Object.freeze(r as CompanyDocument);

const toCompany = (r: typeof companies.$inferSelect): Company =>
  Object.freeze({
    id: r.id,
    slug: r.slug,
    name: r.name,
    kind: r.kind as CompanyKind,
    city: r.city,
    country: r.country,
    ownerUserId: r.ownerUserId,
    contact: Object.freeze({ email: r.contactEmail, phone: r.contactPhone, website: r.website }),
    status: r.status as CompanyStatus,
    createdAt: r.createdAt,
  });

const toArticle = (r: typeof articles.$inferSelect): Article =>
  Object.freeze({
    id: r.id,
    companyId: r.companyId,
    code: r.code,
    slug: r.slug,
    specs: Object.freeze({ weight: r.weight, composition: r.composition, finish: r.finish, moq: r.moq, leadTimeWeeks: r.leadTimeWeeks }),
    createdAt: r.createdAt,
  });

export function createSupplierRepositories(db: Db): {
  companies: CompanyRepository;
  articles: ArticleRepository;
  registrations: RegistrationRepository;
  reviewEvents: ReviewEventRepository;
  documents: CompanyDocumentRepository;
} {
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
      async save({ contact, ...c }) {
        const row = { ...c, contactEmail: contact.email, contactPhone: contact.phone, website: contact.website };
        await db.insert(companies).values(row).onConflictDoUpdate({ target: companies.id, set: row });
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
    registrations: {
      async find(companyId) {
        const [r] = await db.select().from(companyRegistrations).where(eq(companyRegistrations.companyId, companyId)).limit(1);
        return r ? (Object.freeze(r) as Registration) : null;
      },
      async save(r) {
        const row = { ...r, naceCodes: [...r.naceCodes], certifications: [...r.certifications] };
        await db.insert(companyRegistrations).values(row).onConflictDoUpdate({ target: companyRegistrations.companyId, set: row });
      },
      async taxIdTaken(country, taxId, exceptCompanyId) {
        const rows = await db
          .select({ id: companies.id })
          .from(companyRegistrations)
          .innerJoin(companies, eq(companies.id, companyRegistrations.companyId))
          .where(and(
            eq(companies.country, country),
            eq(companyRegistrations.taxId, taxId),
            ne(companies.id, exceptCompanyId),
            inArray(companies.status, ['submitted', 'changes_requested', 'approved']),
          ))
          .limit(1);
        return rows.length > 0;
      },
    },
    reviewEvents: {
      async add(e) {
        await db.insert(companyReviewEvents).values(e);
      },
      async listByCompany(companyId) {
        const rows = await db.select().from(companyReviewEvents).where(eq(companyReviewEvents.companyId, companyId)).orderBy(asc(companyReviewEvents.createdAt));
        return rows.map((r): ReviewEvent => Object.freeze({ ...r, action: r.action as ReviewAction }));
      },
    },
    documents: {
      async save(d) {
        await db.insert(companyDocuments).values(d).onConflictDoUpdate({ target: companyDocuments.id, set: d });
      },
      async findById(id) {
        const [r] = await db.select().from(companyDocuments).where(eq(companyDocuments.id, id)).limit(1);
        return r ? toDocument(r) : null;
      },
      async listByCompany(companyId) {
        const rows = await db.select().from(companyDocuments).where(eq(companyDocuments.companyId, companyId)).orderBy(asc(companyDocuments.createdAt));
        return rows.map(toDocument);
      },
      async delete(id) {
        await db.delete(companyDocuments).where(eq(companyDocuments.id, id));
      },
      async deleteByCompany(companyId) {
        await db.delete(companyDocuments).where(eq(companyDocuments.companyId, companyId));
      },
    },
  };
}
