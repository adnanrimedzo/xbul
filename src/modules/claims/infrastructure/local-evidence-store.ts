import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { EvidenceStore } from '../application/ports';

// The one shape createEvidence produces. No dots or slashes beyond the two separators, so a key can't leave `dir`.
const KEY = /^evidence\/[0-9a-zA-Z-]+\/[0-9a-zA-Z-]+$/;

// Files on local disk, for development and tests. The content type lives in the database row, so it isn't stored here.
export function createLocalEvidenceStore(dir: string): EvidenceStore {
  const root = resolve(dir);
  const pathOf = (key: string): string => {
    if (!KEY.test(key)) throw new Error(`Not an evidence storage key: ${JSON.stringify(key)}`);
    return join(root, key);
  };

  return {
    async put(key, bytes) {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(path, bytes, { mode: 0o600 });
    },
    async get(key) {
      const path = pathOf(key);
      try {
        return new Uint8Array(await readFile(path));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async delete(key) {
      await rm(pathOf(key), { force: true }); // force: a file that is already gone is not an error
    },
  };
}
