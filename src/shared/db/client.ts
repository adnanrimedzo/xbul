import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

export type Db = PgDatabase<PgQueryResultHKT>;

declare global {
  var __xmDb: Map<string, Db> | undefined;
}

// One instance per Postgres URL or PGlite directory (keyed by absolute path), shared across Next dev hot
// reloads and module layers, so pools and data folders aren't reopened per request.
export function createDb(url: string): Db {
  const postgres = url.startsWith('postgres');
  const key = postgres ? url : resolve(url);
  const cache = (globalThis.__xmDb ??= new Map());
  let db = cache.get(key);
  if (!db) {
    if (postgres) {
      const pool = new Pool({ connectionString: url, max: 5 });
      pool.on('error', (e) => console.error('[db] pool error', e)); // an idle client's error would otherwise crash the process
      db = drizzlePg({ client: pool }) as unknown as Db;
    } else {
      // PGlite's NodeFS mkdir is non-recursive, so a fresh clone without `.data/` would crash.
      mkdirSync(dirname(key), { recursive: true });
      db = drizzlePglite({ client: new PGlite(key) }) as unknown as Db;
    }
    cache.set(key, db);
  }
  return db;
}
