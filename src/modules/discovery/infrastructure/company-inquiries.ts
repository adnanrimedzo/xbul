import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { products } from '@/modules/catalog';
import { inquiries } from '@/modules/inquiry';
import { articles, companies } from '@/modules/supplier';
import type { InquiryRow } from './types';

export async function listCompanyInquiries(db: Db, companyId: string): Promise<InquiryRow[]> {
  const rows = await db
    .select({ i: inquiries, companySlug: companies.slug, brand: products.brand, productName: products.name, articleCode: articles.code, articleSlug: articles.slug })
    .from(inquiries)
    .innerJoin(companies, eq(inquiries.companyId, companies.id))
    .leftJoin(products, eq(inquiries.productId, products.id))
    .leftJoin(articles, eq(inquiries.articleId, articles.id))
    .where(eq(inquiries.companyId, companyId))
    .orderBy(sql`${inquiries.status} = 'new' desc`, desc(inquiries.createdAt));

  return rows.map(({ i, companySlug, brand, productName, articleCode, articleSlug }) => ({
    id: i.id,
    kind: i.kind as InquiryRow['kind'],
    status: i.status as InquiryRow['status'],
    buyerName: i.buyerName,
    buyerEmail: i.buyerEmail,
    buyerCompany: i.buyerCompany,
    quantityMeters: i.quantityMeters,
    message: i.message,
    viaAgentHandle: i.viaAgentHandle,
    createdAt: i.createdAt,
    target:
      i.productId && brand
        ? { href: `/p/${i.productId}`, label: `${brand} — ${productName}` }
        : articleCode && articleSlug
          ? { href: `/m/${companySlug}/a/${articleSlug}`, label: `Article ${articleCode}` }
          // The target row was deleted after the inquiry arrived; point at the mill's own page.
          : { href: `/m/${companySlug}`, label: 'Removed item' },
  }));
}
