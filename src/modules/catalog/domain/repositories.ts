import type { ProductTypeId } from '@/shared/domain/taxonomy';
import type { Product } from './product';

export interface ProductRepository {
  save(p: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  findByCanonicalUrl(url: string): Promise<Product | null>;
  // One conditional UPDATE, so concurrent first claimers can't overwrite each other: the first one wins.
  setTypeIfNull(id: string, type: ProductTypeId): Promise<void>;
}
