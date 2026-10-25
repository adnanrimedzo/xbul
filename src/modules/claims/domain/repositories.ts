import type { Claim } from './claim';

export interface ClaimRepository {
  save(c: Claim): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  findByProductAndCompany(productId: string, companyId: string): Promise<Claim | null>;
  findVerifiedOriginal(productId: string): Promise<Claim | null>;
}
