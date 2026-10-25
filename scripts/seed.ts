import { createDb } from '@/shared/db/client';
import { seedDemo } from '@/server/seed-demo';

const db = createDb(process.env.DATABASE_URL ?? './.data/dev');
try {
  await seedDemo(db);
} finally {
  // Closing the driver lets PGlite flush to disk before the process exits. Db doesn't type `$client`.
  const client = (db as unknown as { $client: { close?: () => Promise<void>; end?: () => Promise<void> } }).$client;
  await (client.close?.() ?? client.end?.());
}
