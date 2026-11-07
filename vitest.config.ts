import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    setupFiles: ['src/test/setup.ts'],
    // Starting PGlite takes about 3 s when test files run in parallel, and more on a busy machine or a small CI runner.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next/root-params': fileURLToPath(new URL('./src/test/root-params.ts', import.meta.url)),
    },
  },
});
