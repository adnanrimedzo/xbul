import { and, count, eq, gte } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { Inquiry, InquiryKind } from '../domain/inquiry';
import type { InquiryRepository } from '../domain/repositories';
import { inquiries } from './schema';

const toInquiry = (r: typeof inquiries.$inferSelect): Inquiry =>
  Object.freeze({
    id: r.id,
    companyId: r.companyId,
    productId: r.productId,
    articleId: r.articleId,
    kind: r.kind as InquiryKind,
    buyerName: r.buyerName,
    buyerEmail: r.buyerEmail,
    buyerCompany: r.buyerCompany,
    quantityMeters: r.quantityMeters,
    message: r.message,
    viaAgentHandle: r.viaAgentHandle,
    status: r.status as Inquiry['status'],
    createdAt: r.createdAt,
  });

export function createInquiryRepository(db: Db): InquiryRepository {
  return {
    async save(i) {
      await db.insert(inquiries).values(i).onConflictDoUpdate({ target: inquiries.id, set: i });
    },
    async findById(id) {
      const [row] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
      return row ? toInquiry(row) : null;
    },
    async countRecentFrom(companyId, buyerEmail, since) {
      const [row] = await db
        .select({ n: count() })
        .from(inquiries)
        .where(and(eq(inquiries.companyId, companyId), eq(inquiries.buyerEmail, buyerEmail), gte(inquiries.createdAt, since)));
      return row.n;
    },
    async countNew(companyId) {
      const [row] = await db.select({ n: count() }).from(inquiries).where(and(eq(inquiries.companyId, companyId), eq(inquiries.status, 'new')));
      return row.n;
    },
  };
}
