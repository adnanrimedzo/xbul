import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

export type Db = PgDatabase<PgQueryResultHKT>;

declare global {
  var __xmPglite: Map<string, Db> | undefined;
}

export function createDb(url: string): Db {
  if (url.startsWith('postgres')) {
    return drizzlePg({ client: new Pool({ connectionString: url, max: 5 }) }) as unknown as Db;
  }
  // One PGlite per directory (keyed by absolute path), shared across Next dev hot reloads and module layers.
  const dir = resolve(url);
  const cache = (globalThis.__xmPglite ??= new Map());
  let db = cache.get(dir);
  if (!db) {
    // PGlite's NodeFS mkdir is non-recursive, so a fresh clone without `.data/` would crash.
    mkdirSync(dirname(dir), { recursive: true });
    db = drizzlePglite({ client: new PGlite(dir) }) as unknown as Db;
    cache.set(dir, db);
  }
  return db;
}
