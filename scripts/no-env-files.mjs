import { readdirSync } from 'node:fs';

// OpenNext compiles every .env file into the worker, so a local DATABASE_URL or secret would ship to production.
const found = readdirSync('.').filter((name) => /^\.env(\..+)?$/.test(name) && name !== '.env.example');
if (found.length > 0) {
  console.error(
    `Refusing to build the worker: ${found.join(', ')} would be compiled into it.\n` +
      'Move the file out of the project root first. Local preview settings go in .dev.vars, production ones in wrangler.jsonc vars and wrangler secrets.',
  );
  process.exit(1);
}
