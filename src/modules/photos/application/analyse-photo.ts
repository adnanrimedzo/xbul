import { DomainError } from '@/shared/domain/errors';
import { sniffFileType } from '@/shared/domain/uploaded-file';
import { MAX_PHOTO_BYTES } from '../domain/photo-check';
import { gateDecision, parseVerdict, type GateDecision, type GateReason, type Verdict } from '../domain/verdict';
import type { PhotoModel } from './ports';

export const EMBEDDING_DIMENSIONS = 768;

export type Analysis = { verdict: Verdict; embedding: number[]; decision: GateDecision; reason: GateReason | null };

// Checks the bytes, then asks the model what the photo shows and for its vector, in parallel. Nothing is stored here:
// callers store a photo only once it is accepted, so a rejected (or unsafe) image never reaches the bucket.
// Only JPEG: our page always sends the browser's canvas re-encode, which also strips EXIF and GPS data.
export async function analysePhoto(model: PhotoModel, bytes: Uint8Array): Promise<Analysis> {
  if (bytes.length > MAX_PHOTO_BYTES) throw new DomainError('photo.too_large');
  if (sniffFileType(bytes) !== 'image/jpeg') throw new DomainError('photo.type_invalid');
  const base64 = Buffer.from(bytes).toString('base64'); // once, for both calls; never btoa on a string this long
  const [raw, embedding] = await Promise.all([model.inspect(base64), model.embedImage(base64)]);
  if (embedding.length !== EMBEDDING_DIMENSIONS || !embedding.every(Number.isFinite)) throw new DomainError('photo.ai_unavailable');
  const verdict = parseVerdict(raw);
  return { verdict, embedding, ...gateDecision(verdict) };
}
