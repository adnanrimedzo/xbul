import type { GateDecision, GateReason, Verdict } from './verdict';

// One row per AI check of a photo: a buyer's search, or a supplier's upload. The rows count toward the daily caps and
// the stats; a buyer's accepted search also keeps its photo and vector for PHOTO_RETENTION_DAYS.
export type PhotoCheckSource = 'buyer' | 'supplier';

export type PhotoCheck = Readonly<{
  id: string;
  source: PhotoCheckSource;
  companyId: string | null;
  visitorHash: string | null;
  decision: GateDecision;
  reason: GateReason | null;
  verdict: Verdict;
  closeUp: Verdict | null;
  photoKey: string | null;
  embedding: readonly number[] | null;
  embeddingModel: string;
  createdAt: Date;
}>;

export const PHOTO_RETENTION_DAYS = 7;
export const VISITOR_DAILY_LIMIT = 30;
export const COMPANY_DAILY_LIMIT = 100;
// The browser sends a ≤1024 px JPEG (well under 1 MB); anything bigger was not prepared by our page.
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const DAY = 24 * 60 * 60 * 1000;
export const retentionCutoff = (now: Date) => new Date(now.getTime() - PHOTO_RETENTION_DAYS * DAY);
export const dayAgo = (now: Date) => new Date(now.getTime() - DAY);
export const isExpired = (createdAt: Date, now: Date = new Date()) => createdAt < retentionCutoff(now);

// The date in the key lets an R2 lifecycle rule (or a person) find a day's photos without the database.
export function searchPhotoKey(id: string, now: Date): string {
  return `photo-searches/${now.toISOString().slice(0, 10).replaceAll('-', '')}/${id}`;
}
