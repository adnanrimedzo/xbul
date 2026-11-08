import { asc, desc, eq, max, sql } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { findUserEmail } from '@/modules/identity';
import {
  companies, companyChecks, companyReviewEvents, createSupplierRepositories, missingForSubmit,
  type CheckResult, type CompanyKind, type CompanyStatus, type DocumentKind, type Registration, type ReviewEvent,
} from '@/modules/supplier';
import type { CompanyRef } from './types';

export type RegistrationRow = {
  companyId: string;
  slug: string;
  name: string;
  kind: CompanyKind;
  country: string;
  status: CompanyStatus;
  submittedAt: Date | null; // the latest submission; null when there is none on record
  checks: { pass: number; fail: number; unknown: number };
};

export type RegistrationReview = {
  company: CompanyRef & { status: CompanyStatus; ownerUserId: string; ownerEmail: string | null };
  registration: Registration | null;
  documents: { id: string; kind: DocumentKind; fileName: string; sizeBytes: number }[];
  checks: CheckResult[];
  events: (ReviewEvent & { actorEmail: string | null })[]; // newest first
  missing: string[];
};

const outcomeCount = (outcome: string) => sql<number>`count(*) filter (where ${companyChecks.outcome} = ${outcome})`.mapWith(Number);

// The queue for one status. Submitted: longest waiting first. Every other status: newest first.
// A company with no submission on record sorts by when it was created.
export async function listRegistrations(db: Db, status: CompanyStatus): Promise<RegistrationRow[]> {
  const submitted = db
    .select({ companyId: companyReviewEvents.companyId, at: max(companyReviewEvents.createdAt).as('submitted_at') })
    .from(companyReviewEvents)
    .where(eq(companyReviewEvents.action, 'submitted'))
    .groupBy(companyReviewEvents.companyId)
    .as('submitted');
  const counts = db
    .select({ companyId: companyChecks.companyId, pass: outcomeCount('pass').as('pass'), fail: outcomeCount('fail').as('fail'), unknown: outcomeCount('unknown').as('unknown') })
    .from(companyChecks)
    .groupBy(companyChecks.companyId)
    .as('counts');
  const waiting = sql`coalesce(${submitted.at}, ${companies.createdAt})`;
  const rows = await db
    .select({
      companyId: companies.id, slug: companies.slug, name: companies.name, kind: companies.kind, country: companies.country, status: companies.status,
      submittedAt: submitted.at, pass: counts.pass, fail: counts.fail, unknown: counts.unknown,
    })
    .from(companies)
    .leftJoin(submitted, eq(submitted.companyId, companies.id))
    .leftJoin(counts, eq(counts.companyId, companies.id))
    .where(eq(companies.status, status))
    .orderBy(...(status === 'submitted' ? [asc(waiting), asc(companies.id)] : [desc(waiting), desc(companies.id)]));
  return rows.map(({ pass, fail, unknown, ...r }) => ({
    ...r,
    kind: r.kind as CompanyKind,
    status: r.status as CompanyStatus,
    checks: { pass: pass ?? 0, fail: fail ?? 0, unknown: unknown ?? 0 },
  }));
}

// Everything the review page shows for one company, or null when there is no such company.
export async function getRegistrationReview(db: Db, companyId: string): Promise<RegistrationReview | null> {
  const repos = createSupplierRepositories(db);
  const company = await repos.companies.findById(companyId);
  if (!company) return null;
  const [registration, files, checks, events] = await Promise.all([
    repos.registrations.find(companyId),
    repos.documents.listByCompany(companyId),
    repos.checks.list(companyId),
    repos.reviewEvents.listByCompany(companyId),
  ]);
  const actors = [...new Set([company.ownerUserId, ...events.map((e) => e.actorUserId)])];
  const emails = new Map(await Promise.all(actors.map(async (id) => [id, await findUserEmail(db, id)] as const)));
  const { id, slug, name, kind, city, country, contact, status, ownerUserId } = company;
  return {
    company: { id, slug, name, kind, city, country, contact, status, ownerUserId, ownerEmail: emails.get(ownerUserId) ?? null },
    registration,
    documents: files.map((f) => ({ id: f.id, kind: f.kind, fileName: f.fileName, sizeBytes: f.sizeBytes })),
    checks,
    events: events.map((e) => ({ ...e, actorEmail: emails.get(e.actorUserId) ?? null })).reverse(),
    missing: missingForSubmit(country, registration, files.map((f) => f.kind)),
  };
}
