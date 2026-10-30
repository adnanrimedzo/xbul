import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { Evidence, EvidenceType } from '../domain/evidence';
import type { EvidenceRepository } from '../domain/repositories';
import { claimEvidence } from './schema';

const toEvidence = (r: typeof claimEvidence.$inferSelect): Evidence =>
  Object.freeze({
    id: r.id,
    claimId: r.claimId,
    fileName: r.fileName,
    contentType: r.contentType as EvidenceType,
    sizeBytes: r.sizeBytes,
    storageKey: r.storageKey,
    createdAt: r.createdAt,
  });

export function createEvidenceRepository(db: Db): EvidenceRepository {
  return {
    async save(e) {
      await db.insert(claimEvidence).values(e);
    },
    async findById(id) {
      const [row] = await db.select().from(claimEvidence).where(eq(claimEvidence.id, id)).limit(1);
      return row ? toEvidence(row) : null;
    },
    async listByClaim(claimId) {
      const rows = await db.select().from(claimEvidence).where(eq(claimEvidence.claimId, claimId)).orderBy(asc(claimEvidence.createdAt), asc(claimEvidence.id));
      return rows.map(toEvidence);
    },
    async delete(id) {
      await db.delete(claimEvidence).where(eq(claimEvidence.id, id));
    },
    async deleteByClaim(claimId) {
      await db.delete(claimEvidence).where(eq(claimEvidence.claimId, claimId));
    },
  };
}
