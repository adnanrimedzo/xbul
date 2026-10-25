import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from '@/modules/catalog/infrastructure/schema';
import { articles, companies } from '@/modules/supplier/infrastructure/schema';

export const inquiries = pgTable(
  'inquiries',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    articleId: uuid('article_id').references(() => articles.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    buyerName: text('buyer_name').notNull(),
    buyerEmail: text('buyer_email').notNull(),
    buyerCompany: text('buyer_company'),
    quantityMeters: integer('quantity_meters'),
    message: text('message'),
    viaAgentHandle: text('via_agent_handle'),
    status: text('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('inquiries_company_email_created_idx').on(t.companyId, t.buyerEmail, t.createdAt)],
);
