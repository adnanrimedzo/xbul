import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { createDb } from './client';

const tmp = mkdtempSync(join(tmpdir(), 'xm-db-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

it('creates the missing parent folder for a PGlite directory', async () => {
  const db = await createDb(join(tmp, 'missing', 'dev'));
  const res = (await db.execute(sql`select 1 as one`)) as { rows: unknown[] };
  expect(res.rows[0]).toEqual({ one: 1 });
});

it('returns one instance for a relative and an absolute path to the same directory, even when opened concurrently', async () => {
  const abs = join(tmp, 'same');
  const [a, b] = await Promise.all([createDb(relative(process.cwd(), abs)), createDb(abs)]);
  expect(a).toBe(b);
});

it('returns one instance per Postgres URL without connecting', async () => {
  // pg.Pool is lazy: constructing it opens no socket, so port 1 is never dialled.
  const url = 'postgres://u:p@127.0.0.1:1/x';
  expect(await createDb(url)).toBe(await createDb(url));
  expect(await createDb(`${url}2`)).not.toBe(await createDb(url));
});

it('forgets a failed open so the next call can retry', async () => {
  // A file where the parent folder should be makes the first open fail.
  const blocker = join(tmp, 'blocker');
  writeFileSync(blocker, '');
  const dir = join(blocker, 'dev');
  await expect(createDb(dir)).rejects.toThrow();
  rmSync(blocker);
  const db = await createDb(dir);
  expect(((await db.execute(sql`select 1 as one`)) as { rows: unknown[] }).rows[0]).toEqual({ one: 1 });
});
