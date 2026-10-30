import { char, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('fabric_mill'),
  city: text('city').notNull(),
  country: char('country', { length: 2 }).notNull(),
  ownerUserId: text('owner_user_id').notNull().unique(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  website: text('website'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    slug: text('slug').notNull(),
    weight: text('weight'),
    composition: text('composition'),
    finish: text('finish'),
    moq: text('moq'),
    leadTimeWeeks: integer('lead_time_weeks'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('articles_company_code_uq').on(t.companyId, t.code),
    uniqueIndex('articles_company_slug_uq').on(t.companyId, t.slug),
  ],
);
