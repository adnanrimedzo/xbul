import { index, jsonb, pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { articles, companies } from '@/modules/supplier/infrastructure/schema';
import type { PhotoTags } from '../domain/photo-tags';
import type { Verdict } from '../domain/verdict';

// Vector length of the embedding model (EMBEDDING_DIMENSIONS). Changing models means a migration and re-embedding.
const DIMENSIONS = 768;

// A supplier's photo of its own product, in the private R2 bucket under photo_key.
// ponytail: no vector index; an exact scan is fast and exact at thousands of photos. Add HNSW
// (image_embedding vector_cosine_ops) at about 50k rows.
export const supplierPhotos = pgTable(
  'supplier_photos',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id').references(() => articles.id, { onDelete: 'set null' }),
    photoKey: text('photo_key').notNull(),
    status: text('status').notNull().default('draft'),
    tags: jsonb('tags').$type<PhotoTags>().notNull(),
    imageEmbedding: vector('image_embedding', { dimensions: DIMENSIONS }).notNull(),
    embeddingModel: text('embedding_model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [index('supplier_photos_company_idx').on(t.companyId)],
);

// One row per AI check (buyer search or supplier upload): daily caps, stats, and a buyer's search for 7 days.
export const photoChecks = pgTable(
  'photo_checks',
  {
    id: uuid('id').primaryKey(),
    source: text('source').notNull(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    visitorHash: text('visitor_hash'),
    decision: text('decision').notNull(),
    reason: text('reason'),
    verdict: jsonb('verdict').$type<Verdict>().notNull(),
    closeUp: jsonb('close_up').$type<Verdict>(), // a buyer's optional fabric close-up, checked on its own
    photoKey: text('photo_key'),
    embedding: vector('embedding', { dimensions: DIMENSIONS }),
    embeddingModel: text('embedding_model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('photo_checks_visitor_idx').on(t.visitorHash, t.createdAt),
    index('photo_checks_company_idx').on(t.companyId, t.createdAt),
    index('photo_checks_created_idx').on(t.createdAt),
  ],
);
