import { DomainError } from '@/shared/domain/errors';
import { newId } from '@/shared/domain/ids';
import type { ProductTypeId } from '@/shared/domain/taxonomy';

export type Product = Readonly<{
  id: string;
  canonicalUrl: string;
  sourceUrl: string;
  brand: string;
  name: string;
  imageUrl: string | null;
  composition: string | null;
  type: ProductTypeId | null;
  createdAt: Date;
}>;

export type ProductSnapshot = { brand: string; name: string; imageUrl: string | null; composition: string | null };

export function createProduct(input: Omit<Product, 'id' | 'createdAt' | 'type'>, now: Date = new Date()): Product {
  const brand = input.brand.trim();
  if (brand.length < 1 || brand.length > 60) throw new DomainError('product.brand_invalid');
  const name = input.name.trim();
  if (name.length < 1 || name.length > 160) throw new DomainError('product.name_invalid');
  const imageUrl = input.imageUrl && /^https?:\/\//i.test(input.imageUrl) ? input.imageUrl : null;
  return Object.freeze({
    id: newId(),
    canonicalUrl: input.canonicalUrl,
    sourceUrl: input.sourceUrl,
    brand,
    name,
    imageUrl,
    composition: input.composition,
    type: null,
    createdAt: now,
  });
}
