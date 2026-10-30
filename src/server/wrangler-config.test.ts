import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// Every comment in wrangler.jsonc sits on its own line.
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const prod = config;
const staging = config.env.staging;

test('production points at the real origin', () => {
  expect(prod.vars.PUBLIC_BASE_URL).toBe('https://xbul.ai');
});

test('staging shares nothing with production', () => {
  expect(staging.name).toBe('xbul-staging');
  expect(staging.vars.PUBLIC_BASE_URL).toBe('https://staging.xbul.ai');
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

test('the worker runs beside the database', () => {
  expect(prod.placement).toEqual({ region: 'aws:eu-central-1' });
});
