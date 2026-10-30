import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createLocalEvidenceStore } from './local-evidence-store';
import { createR2EvidenceStore } from './r2-evidence-store';

const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const KEY = 'evidence/c1-claim/e1-file';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'xm-evidence-store-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('local store: puts, gets and deletes a file', async () => {
  const dir = join(root, 'store');
  const store = createLocalEvidenceStore(dir);
  await store.put(KEY, PDF, 'application/pdf');
  expect(existsSync(join(dir, KEY))).toBe(true);
  expect(await store.get(KEY)).toEqual(PDF);
  await store.delete(KEY);
  expect(await store.get(KEY)).toBeNull();
  await expect(store.delete(KEY)).resolves.toBeUndefined(); // already gone
});

it('local store: refuses a key that could leave its folder, for every operation, and writes nothing', async () => {
  const dir = join(root, 'store');
  const store = createLocalEvidenceStore(dir);
  for (const key of ['../x', 'evidence/../x', 'evidence/a/../../x', 'evidence/a/b/c', 'evidence//b', '/etc/passwd', 'evidence/a/b.pdf', 'evidence/a/b\n', 'x']) {
    await expect(store.put(key, PDF, 'application/pdf'), key).rejects.toThrow('Not an evidence storage key');
    await expect(store.get(key), key).rejects.toThrow('Not an evidence storage key');
    await expect(store.delete(key), key).rejects.toThrow('Not an evidence storage key');
  }
  expect(readdirSync(root)).toEqual([]);
});

it('local store: a missing file is null, not an error', async () => {
  const store = createLocalEvidenceStore(join(root, 'store'));
  expect(await store.get(KEY)).toBeNull();
});

it('r2 store: puts, gets and deletes through the bucket, with the content type', async () => {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const store = createR2EvidenceStore({
    put: async (key, value, options) => void objects.set(key, { bytes: value, contentType: options.httpMetadata.contentType }),
    get: async (key) => {
      const object = objects.get(key);
      return object ? { arrayBuffer: async () => object.bytes.slice().buffer } : null;
    },
    delete: async (key) => void objects.delete(key),
  });
  await store.put(KEY, PDF, 'application/pdf');
  expect(objects.get(KEY)?.contentType).toBe('application/pdf');
  expect(await store.get(KEY)).toEqual(PDF);
  expect(await store.get('evidence/c1/missing')).toBeNull();
  await store.delete(KEY);
  expect(objects.size).toBe(0);
});
