import { sql } from 'drizzle-orm';
import { char, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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
  status: text('status').notNull().default('draft'),
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

export const companyRegistrations = pgTable('company_registrations', {
  companyId: uuid('company_id').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  taxOffice: text('tax_office'),
  registryNumber: text('registry_number'),
  mersisNumber: text('mersis_number'),
  industryRegistryNumber: text('industry_registry_number'),
  lei: text('lei'),
  registeredAddress: text('registered_address'),
  facilityAddress: text('facility_address'),
  monthlyCapacity: text('monthly_capacity'),
  openSupplyHubId: text('open_supply_hub_id'),
  employees: text('employees'),
  naceCodes: text('nace_codes').array().notNull().default(sql`'{}'::text[]`),
  certifications: jsonb('certifications').$type<{ scheme: string; number: string; validUntil: string | null }[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const companyReviewEvents = pgTable(
  'company_review_events',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action').notNull(),
    note: text('note'),
    changes: jsonb('changes').$type<Record<string, [unknown, unknown]>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('company_review_events_company_idx').on(t.companyId, t.createdAt)],
);

export const companyDocuments = pgTable(
  'company_documents',
  {
    id: uuid('id').primaryKey(),
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('company_documents_company_idx').on(t.companyId)],
);

// The latest outcome per check source for a company; a re-run replaces them all.
export const companyChecks = pgTable(
  'company_checks',
  {
    companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    outcome: text('outcome').notNull(),
    summary: text('summary').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.source] })],
);
