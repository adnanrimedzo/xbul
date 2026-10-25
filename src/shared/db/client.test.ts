import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { createDb } from './client';

const tmp = mkdtempSync(join(tmpdir(), 'xm-db-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

it('creates the missing parent folder for a PGlite directory', async () => {
  const db = createDb(join(tmp, 'missing', 'dev'));
  const res = (await db.execute(sql`select 1 as one`)) as { rows: unknown[] };
  expect(res.rows[0]).toEqual({ one: 1 });
});

it('returns one instance for a relative and an absolute path to the same directory', () => {
  const abs = join(tmp, 'same');
  expect(createDb(relative(process.cwd(), abs))).toBe(createDb(abs));
});
