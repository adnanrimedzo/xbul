import type { Claim, ClaimScope } from './claim';
import type { Evidence } from './evidence';

export interface ClaimRepository {
  save(c: Claim): Promise<void>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  findByProductAndCompany(productId: string, companyId: string): Promise<Claim | null>;
  existsForProduct(productId: string): Promise<boolean>;
  findVerifiedOriginal(productId: string, scope: ClaimScope): Promise<Claim | null>;
}

export interface EvidenceRepository {
  save(e: Evidence): Promise<void>;
  findById(id: string): Promise<Evidence | null>;
  listByClaim(claimId: string): Promise<Evidence[]>;
  delete(id: string): Promise<void>;
  deleteByClaim(claimId: string): Promise<void>;
}
