import type { EvidenceStore } from '../application/ports';

// The part of a Cloudflare R2 bucket binding this store uses, so the store can be tested without one.
export type EvidenceBucket = {
  put(key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<unknown>;
};

// A private bucket: nothing is served from it directly. Files are read back through readEvidence, which checks who is asking.
export function createR2EvidenceStore(bucket: EvidenceBucket): EvidenceStore {
  return {
    async put(key, bytes, contentType) {
      await bucket.put(key, bytes, { httpMetadata: { contentType } });
    },
    async get(key) {
      const object = await bucket.get(key);
      return object ? new Uint8Array(await object.arrayBuffer()) : null;
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
