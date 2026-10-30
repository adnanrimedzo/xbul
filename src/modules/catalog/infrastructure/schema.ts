import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey(),
  canonicalUrl: text('canonical_url').notNull().unique(),
  sourceUrl: text('source_url').notNull(),
  brand: text('brand').notNull(),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  composition: text('composition'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per buyer search. visitor_hash is a per-day keyed hash (see visitorHash), never the address itself.
export const searchEvents = pgTable('search_events', {
  id: uuid('id').primaryKey(),
  matched: boolean('matched').notNull(),
  visitorHash: text('visitor_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
