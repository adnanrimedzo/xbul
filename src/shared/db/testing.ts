import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './client';

export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite({ extensions: { vector } }) });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db as unknown as Db;
}
