import type { Claim, ClaimScope } from './claim';

export interface ClaimRepository {
  save(c: Claim): Promise<void>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Claim | null>;
  findByProductAndCompany(productId: string, companyId: string): Promise<Claim | null>;
  existsForProduct(productId: string): Promise<boolean>;
  findVerifiedOriginal(productId: string, scope: ClaimScope): Promise<Claim | null>;
}
