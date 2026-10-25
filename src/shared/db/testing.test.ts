import { expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from './testing';

it('creates a migrated in-memory database', async () => {
  const db = await createTestDb();
  // PgQueryResultHKT leaves the result type `unknown`, so name the shape both drivers return.
  const res = (await db.execute(sql`select 1 as one`)) as { rows: unknown[] };
  expect(res.rows[0]).toEqual({ one: 1 });
});
