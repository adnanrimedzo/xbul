import type { EvidenceStore } from '@/modules/claims';
import type { ArticleRepository } from '@/modules/supplier';
import type { PhotoCheckRepository, SupplierPhotoRepository } from '../domain/repositories';

// The AI behind photo search. Both calls take the same base64 JPEG (encoded once). `inspect` returns the model's raw
// verdict, which parseVerdict checks; `embedImage` returns a vector of the length the schema declares.
export interface PhotoModel {
  readonly embeddingModel: string;
  inspect(jpegBase64: string): Promise<unknown>;
  embedImage(jpegBase64: string): Promise<number[]>;
}

// Photos go in the same private bucket as evidence, under their own key prefixes.
export type PhotoStore = EvidenceStore;

export type SupplierPhotoDeps = {
  model: PhotoModel;
  store: PhotoStore;
  photos: SupplierPhotoRepository;
  checks: PhotoCheckRepository;
  articles: Pick<ArticleRepository, 'findById'>;
};

export type BuyerPhotoDeps = { model: PhotoModel; store: PhotoStore; checks: PhotoCheckRepository };
