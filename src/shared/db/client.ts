import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

export type Db = PgDatabase<PgQueryResultHKT>;

declare global {
  var __xmDb: Map<string, Promise<Db>> | undefined;
}

// One instance per Postgres URL or PGlite directory (keyed by absolute path), shared across Next dev hot
// reloads and module layers, so pools and data folders aren't reopened per request. The promise is cached, so
// concurrent first calls can't open the same PGlite folder twice; a failed open is dropped so the next call retries.
export function createDb(url: string): Promise<Db> {
  const postgres = url.startsWith('postgres');
  const key = postgres ? url : resolve(url);
  const cache = (globalThis.__xmDb ??= new Map());
  let db = cache.get(key);
  if (!db) {
    db = postgres ? Promise.resolve(createPostgresDb(url).db) : openPglite(key);
    cache.set(key, db);
    db.catch(() => cache.delete(key));
  }
  return db;
}

// A Postgres Db on its own pool, not memoised: Workers can't share I/O across requests, so a Hyperdrive caller
// builds one per request and ends the pool itself.
export function createPostgresDb(url: string): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString: url, max: 5 });
  pool.on('error', (e) => console.error('[db] pool error', e)); // an idle client's error would otherwise crash the process
  return { db: drizzlePg({ client: pool }) as unknown as Db, pool };
}

async function openPglite(dir: string): Promise<Db> {
  // PGlite's NodeFS mkdir is non-recursive, so a fresh clone without `.data/` would crash.
  mkdirSync(dirname(dir), { recursive: true });
  // Imported on demand so the Workers bundle, which only ever talks to Postgres, never evaluates PGlite.
  const [{ PGlite }, { drizzle }] = await Promise.all([import('@electric-sql/pglite'), import('drizzle-orm/pglite')]);
  // Wait for startup so a failed start rejects this promise (and is forgotten) instead of escaping unhandled.
  const client = new PGlite(dir);
  await client.waitReady;
  return drizzle({ client }) as unknown as Db;
}
