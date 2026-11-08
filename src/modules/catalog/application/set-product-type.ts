import { DomainError } from '@/shared/domain/errors';
import { PRODUCT_TYPES, type ProductTypeId } from '@/shared/domain/taxonomy';
import type { ProductRepository } from '../domain/repositories';

// The first supplier to claim a product says what it is; later calls leave it alone.
export async function setProductTypeIfEmpty(deps: { products: ProductRepository }, { productId, type }: { productId: string; type: string }): Promise<void> {
  if (!Object.hasOwn(PRODUCT_TYPES, type)) throw new DomainError('product.type_invalid');
  if (!(await deps.products.findById(productId))) throw new DomainError('product.not_found');
  await deps.products.setTypeIfNull(productId, type as ProductTypeId);
}
