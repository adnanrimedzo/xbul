import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3100';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/fixture-server.mjs', port: 4010 },
    {
      // A fresh seeded PGlite database per run; `.data` must exist because PGlite's mkdir isn't recursive.
      command: 'rm -rf .data/e2e .outbox && mkdir -p .data && pnpm drizzle-kit migrate && pnpm seed && pnpm next dev -p 3100',
      port: 3100,
      timeout: 120_000,
      env: {
        DATABASE_URL: './.data/e2e',
        BETTER_AUTH_URL: baseURL,
        PUBLIC_BASE_URL: baseURL,
        BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
        ADMIN_EMAILS: 'admin@example.test',
        MAIL_LOG_FILE: '.outbox/e2e-mail.log',
        RESEND_API_KEY: '', // a developer's .env.local key must never send e2e mail
        FETCH_ALLOW_PRIVATE_HOSTS: '1',
      },
    },
  ],
});
