import { and, eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { claims } from '@/modules/claims';
import { companies, type CompanyStatus } from '@/modules/supplier';

// Only approved companies are public. Their owner and the admins can still open an unapproved company's own pages.
export const canSeeCompany = (company: { status: CompanyStatus; ownerUserId: string }, viewer: { userId: string; isAdmin: boolean } | null): boolean =>
  company.status === 'approved' || viewer?.isAdmin === true || viewer?.userId === company.ownerUserId;

// Whether an approved company has a claim on the product: a product only unapproved companies claimed is not tagged yet.
export async function hasPublicClaims(db: Db, productId: string): Promise<boolean> {
  const rows = await db
    .select({ id: claims.id })
    .from(claims)
    .innerJoin(companies, eq(claims.companyId, companies.id))
    .where(and(eq(claims.productId, productId), eq(companies.status, 'approved')))
    .limit(1);
  return rows.length > 0;
}
