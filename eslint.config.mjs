import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const deepImport = { group: ['@/modules/*/*', '!@/modules/*/infrastructure/*schema'], message: 'Import a module through its index.ts' };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  { files: ['src/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', { patterns: [deepImport] }] } },
  // The domain block repeats deepImport because a later config overrides the rule entirely.
  { files: ['src/modules/*/domain/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: [deepImport,
    { group: ['next', 'next/*', 'react', 'react-dom', 'drizzle-orm', 'drizzle-orm/*', 'better-auth', 'better-auth/*', '@/modules/*', '@/server/*', '@/app/*'], message: 'Domain stays pure' }] }] } },
]);

export default eslintConfig;
