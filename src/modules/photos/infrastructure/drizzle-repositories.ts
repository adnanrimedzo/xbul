import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { PhotoCheck, PhotoCheckSource } from '../domain/photo-check';
import type { PhotoCheckRepository, SupplierPhotoRepository } from '../domain/repositories';
import type { SupplierPhoto, SupplierPhotoStatus } from '../domain/supplier-photo';
import type { GateDecision, GateReason } from '../domain/verdict';
import { photoChecks, supplierPhotos } from './schema';

const toPhoto = (r: typeof supplierPhotos.$inferSelect): SupplierPhoto =>
  Object.freeze({
    id: r.id,
    companyId: r.companyId,
    articleId: r.articleId,
    photoKey: r.photoKey,
    status: r.status as SupplierPhotoStatus,
    tags: r.tags,
    embedding: r.imageEmbedding,
    embeddingModel: r.embeddingModel,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    publishedAt: r.publishedAt,
  });

export function createSupplierPhotoRepository(db: Db): SupplierPhotoRepository {
  return {
    async save(p) {
      const { embedding, ...rest } = p;
      const row = { ...rest, imageEmbedding: [...embedding] };
      await db.insert(supplierPhotos).values(row).onConflictDoUpdate({
        target: supplierPhotos.id,
        set: { articleId: p.articleId, status: p.status, tags: p.tags, updatedAt: p.updatedAt, publishedAt: p.publishedAt },
      });
    },
    async findById(id) {
      const [row] = await db.select().from(supplierPhotos).where(eq(supplierPhotos.id, id)).limit(1);
      return row ? toPhoto(row) : null;
    },
    async listByCompany(companyId) {
      const rows = await db.select().from(supplierPhotos).where(eq(supplierPhotos.companyId, companyId)).orderBy(desc(supplierPhotos.createdAt), desc(supplierPhotos.id));
      return rows.map(toPhoto);
    },
    async countByCompany(companyId) {
      const [row] = await db.select({ n: count() }).from(supplierPhotos).where(eq(supplierPhotos.companyId, companyId));
      return row?.n ?? 0;
    },
    async delete(id) {
      await db.delete(supplierPhotos).where(eq(supplierPhotos.id, id));
    },
  };
}

const toCheck = (r: typeof photoChecks.$inferSelect): PhotoCheck =>
  Object.freeze({
    id: r.id,
    source: r.source as PhotoCheckSource,
    companyId: r.companyId,
    visitorHash: r.visitorHash,
    decision: r.decision as GateDecision,
    reason: r.reason as GateReason | null,
    verdict: r.verdict,
    closeUp: r.closeUp,
    photoKey: r.photoKey,
    embedding: r.embedding,
    embeddingModel: r.embeddingModel,
    createdAt: r.createdAt,
  });

export function createPhotoCheckRepository(db: Db): PhotoCheckRepository {
  return {
    async save(c) {
      await db.insert(photoChecks).values({ ...c, embedding: c.embedding ? [...c.embedding] : null });
    },
    async findById(id) {
      const [row] = await db.select().from(photoChecks).where(eq(photoChecks.id, id)).limit(1);
      return row ? toCheck(row) : null;
    },
    async setCloseUp(id, closeUp) {
      await db.update(photoChecks).set({ closeUp }).where(eq(photoChecks.id, id));
    },
    async countSince(who, since) {
      const scope =
        'companyId' in who
          ? eq(photoChecks.companyId, who.companyId)
          : and(eq(photoChecks.source, 'buyer'), who.visitorHash === null ? isNull(photoChecks.visitorHash) : eq(photoChecks.visitorHash, who.visitorHash));
      const [row] = await db.select({ n: count() }).from(photoChecks).where(and(scope, gte(photoChecks.createdAt, since)));
      return row?.n ?? 0;
    },
    async listExpired(before, limit) {
      return db
        .select({ id: photoChecks.id, photoKey: photoChecks.photoKey })
        .from(photoChecks)
        .where(and(lt(photoChecks.createdAt, before), or(isNotNull(photoChecks.photoKey), isNotNull(photoChecks.embedding))))
        .limit(limit);
    },
    async clearExpired(ids) {
      if (ids.length === 0) return;
      await db.update(photoChecks).set({ photoKey: null, embedding: null }).where(inArray(photoChecks.id, [...ids]));
    },
  };
}
