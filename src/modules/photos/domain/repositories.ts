import type { PhotoCheck } from './photo-check';
import type { SupplierPhoto } from './supplier-photo';
import type { Verdict } from './verdict';

export interface SupplierPhotoRepository {
  save(p: SupplierPhoto): Promise<void>; // insert or update
  findById(id: string): Promise<SupplierPhoto | null>;
  listByCompany(companyId: string): Promise<SupplierPhoto[]>; // newest first
  countByCompany(companyId: string): Promise<number>;
  delete(id: string): Promise<void>;
}

// Who a daily cap counts: a supplier company, or a buyer's per-day visitor hash (null when the request had no IP,
// in which case every such request shares one count).
export type CheckCounter = { companyId: string } | { visitorHash: string | null };

export interface PhotoCheckRepository {
  save(c: PhotoCheck): Promise<void>;
  findById(id: string): Promise<PhotoCheck | null>;
  setCloseUp(id: string, closeUp: Verdict): Promise<void>;
  countSince(who: CheckCounter, since: Date): Promise<number>;
  // Buyer searches older than `before` that still hold a photo or a vector.
  listExpired(before: Date, limit: number): Promise<{ id: string; photoKey: string | null }[]>;
  clearExpired(ids: readonly string[]): Promise<void>;
}
