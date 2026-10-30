import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Every comment in wrangler.jsonc sits on its own line.
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const prod = config;
const staging = config.env.staging;

test('production points at the real origin', () => {
  expect(prod.vars.PUBLIC_BASE_URL).toBe('https://xbul.io');
});

test('staging shares nothing with production', () => {
  expect(staging.name).toBe('xbul-staging');
  expect(staging.vars.PUBLIC_BASE_URL).toBe('https://staging.xbul.io');
  expect(staging.r2_buckets[0].binding).toBe('EVIDENCE');
  expect(staging.r2_buckets[0].bucket_name).toBe('xbul-evidence-staging');
  expect(staging.r2_buckets[0].bucket_name).not.toBe(prod.r2_buckets[0].bucket_name);
  expect(staging.hyperdrive[0].binding).toBe('HYPERDRIVE');
  expect(staging.hyperdrive[0].id).not.toBe(prod.hyperdrive[0].id);
});

test('each worker references itself', () => {
  expect(prod.services[0].service).toBe(prod.name);
  expect(staging.services[0].service).toBe(staging.name);
});

test('each worker answers only on its own address', () => {
  for (const worker of [prod, staging]) {
    expect(worker.workers_dev).toBe(false);
    expect(worker.preview_urls).toBe(false);
  }
});

// pnpm/action-setup throws when its version input differs from package.json's packageManager, even by "10" against "10.25.0".
test('workflows take the pnpm version from package.json', () => {
  for (const file of readdirSync('.github/workflows')) {
    const workflow = readFileSync(`.github/workflows/${file}`, 'utf8');
    expect(workflow, file).toMatch(/pnpm\/action-setup/);
    expect(workflow, file).not.toMatch(/action-setup@\S+\s+with:/);
  }
});

test('the worker runs beside the database', () => {
  expect(prod.placement).toEqual({ region: 'aws:eu-central-1' });
});
