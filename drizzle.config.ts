import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? './.data/dev';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/modules/*/infrastructure/*schema.ts',
  out: './drizzle',
  ...(url.startsWith('postgres') ? { dbCredentials: { url } } : { driver: 'pglite', dbCredentials: { url } }),
});
