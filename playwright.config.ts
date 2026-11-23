import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3100';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  // `next dev` compiles each route the first time a test visits it, which takes seconds on a 2-core CI runner, so the
  // first tests to reach a page need far longer there than anywhere else. Locally the defaults stay, so a real hang
  // still fails fast.
  ...(process.env.CI && { timeout: 90_000, expect: { timeout: 20_000 } }),
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/fixture-server.mjs', port: 4010 },
    {
      // A fresh seeded PGlite database per run; `.data` must exist because PGlite's mkdir isn't recursive.
      command: 'rm -rf .data/e2e .data/e2e-evidence .outbox && mkdir -p .data && pnpm db:migrate && pnpm seed && pnpm next dev -p 3100',
      port: 3100,
      timeout: 120_000,
      env: {
        DATABASE_URL: './.data/e2e',
        EVIDENCE_DIR: './.data/e2e-evidence',
        PUBLIC_BASE_URL: baseURL,
        BETTER_AUTH_SECRET: '74a5fe694e2a78fb4c7bb4255c5a0c0cfdf175dbbbe5f310bc24a76311f6289e', // random, so Better Auth's low-entropy warning stays quiet
        ADMIN_EMAILS: 'admin@example.test,admin-maker@example.test',
        MAIL_LOG_FILE: '.outbox/e2e-mail.log',
        RESEND_API_KEY: '', // a developer's .env.local key must never send e2e mail
        FETCH_ALLOW_PRIVATE_HOSTS: '1',
        // Photo search with the deterministic fake model (it keys off the e2e/fixtures/photos sizes), switched on for buyers.
        PHOTO_AI: 'fake',
        PHOTO_SEARCH_PUBLIC: '1',
        // Dummy keys so the provider buttons render; e2e/sign-in.spec.ts stops each flow at the provider's door.
        GOOGLE_CLIENT_ID: 'e2e-google-id',
        GOOGLE_CLIENT_SECRET: 'e2e-google-secret',
        MICROSOFT_CLIENT_ID: 'e2e-microsoft-id',
        MICROSOFT_CLIENT_SECRET: 'e2e-microsoft-secret',
      },
    },
  ],
});
