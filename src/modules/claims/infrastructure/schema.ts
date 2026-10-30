import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { products } from '@/modules/catalog/infrastructure/schema';
import { articles, companies } from '@/modules/supplier/infrastructure/schema';

export const claims = pgTable(
  'claims',
  {
    id: uuid('id').primaryKey(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id').references(() => articles.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    scope: text('scope').notNull().default('fabric'),
    status: text('status').notNull().default('declared'),
    note: text('note'),
    reviewStatus: text('review_status').notNull().default('none'),
    reviewNote: text('review_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('claims_product_company_uq').on(t.productId, t.companyId),
    uniqueIndex('claims_one_verified_original').on(t.productId, t.scope).where(sql`kind = 'original' and status = 'verified'`),
  ],
);

// The documents behind an original claim while it waits for review. Rows and files go once an admin decides.
export const claimEvidence = pgTable(
  'claim_evidence',
  {
    id: uuid('id').primaryKey(),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('claim_evidence_claim_idx').on(t.claimId)],
);
