import type { Product } from './product';

export interface ProductRepository {
  save(p: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  findByCanonicalUrl(url: string): Promise<Product | null>;
}
