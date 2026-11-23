import { createDb } from '@/shared/db/client';

// Replaces `drizzle-kit migrate`, which opens PGlite without extensions and so can't run `CREATE EXTENSION vector`.
// Same migrations folder and the same drizzle.__drizzle_migrations bookkeeping, for PGlite and Postgres alike.
const url = process.env.DATABASE_URL ?? './.data/dev';
const db = await createDb(url);
try {
  const { migrate } = url.startsWith('postgres') ? await import('drizzle-orm/node-postgres/migrator') : await import('drizzle-orm/pglite/migrator');
  await migrate(db as never, { migrationsFolder: 'drizzle' });
  console.log('[migrate] up to date');
} finally {
  // Closing the driver lets PGlite flush to disk and lets the deploy step exit. Db doesn't type `$client`.
  const client = (db as unknown as { $client: { close?: () => Promise<void>; end?: () => Promise<void> } }).$client;
  await (client.close?.() ?? client.end?.());
}
