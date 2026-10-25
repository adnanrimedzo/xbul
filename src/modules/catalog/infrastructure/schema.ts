import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
