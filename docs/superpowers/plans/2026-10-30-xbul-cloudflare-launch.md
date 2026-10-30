# xbul Cloudflare Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement Part 1 task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Part 2 is a rollout that uses the owner's accounts: never run it without the owner's go-ahead for that stage.

**Goal:** Put xbul live on `https://xbul.ai` on Cloudflare, with a staging copy, automated checks, backups, monitoring and a tested way back, ready for the first invited suppliers.

**Architecture:** One Next.js app runs as a Cloudflare Worker through OpenNext, in two environments, staging and production. Each environment has its own Worker, Hyperdrive config, Neon database and R2 bucket. GitHub Actions tests every push, deploys `main` to staging on its own, and deploys production only when the owner starts it by hand.

**Tech Stack:** Next.js 16, OpenNext for Cloudflare, Wrangler 4, Cloudflare Workers, Hyperdrive, R2, Email Routing; Neon Postgres; Resend; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-25-xmanufacture-design.md`. Section 11 is binding. Current deploy steps: `docs/deploy.md`.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Firebase | **Not used** | Every part of it is already covered: Better Auth for sign-in, Neon Postgres for data, R2 for files, Workers for hosting and functions. The per-scope "one verified original" rule relies on a Postgres partial unique index, which Firestore doesn't have. Adding it would mean a second vendor and a second place for user accounts, for no gain. Revisit only for push notifications in a native mobile app. |
| Hosting | Cloudflare Workers Paid, $5/month | The free plan's 10 ms CPU per request is too low to render pages. Paid includes 10M requests, 30M CPU ms and Hyperdrive. |
| Database | Neon Launch for production, Neon Free for staging | Free keeps only 6 hours of restore history. Launch keeps up to 7 days, with no minimum monthly fee. |
| Region | Neon `aws-eu-central-1` (Frankfurt) with the Worker placed next to it | The first suppliers and buyers are in Turkey and Europe. A page runs several queries, so running the Worker beside the database costs one trip to the visitor rather than one per query. Confirm the region in Neon's list when creating the project. |
| Staging address | `https://staging.xbul.ai` | Real sign-in cookies and email links behave as in production. It holds test data only and asks search engines to stay out. |
| Production deploys | Started by hand | At launch the owner should choose when real suppliers see a change. |
| Rollback | `wrangler rollback`, no automatic rollback | A rollback restores code, not the database, so a person should decide. |
| Backups | Neon's 7-day history, plus a weekly dump to a private R2 bucket kept for 90 days | Neon's history covers mistakes. The dump covers losing the Neon project or account. |
| Decision emails | Not in this plan | The first suppliers are invited personally, and the runbook has the owner check the queue every day. Add when volume makes that a chore. |

## Global Constraints

- The product name is `xbul` and the production origin is exactly `https://xbul.ai`.
- Production and staging never share a database, bucket, secret or Worker.
- No `.env*` file except `.env.example` may exist when a Worker is built; `scripts/no-env-files.mjs` enforces this.
- Evidence buckets are never public: no custom domain and no `r2.dev` URL.
- Never run `pnpm seed` against production.
- Migrations must be safe for the previous code version: add first, remove in a later release, because `wrangler rollback` doesn't undo a migration.
- No new runtime dependencies.
- Agents never create accounts, buy anything, or enter real secrets. Those are the owner's steps.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code, as `AGENTS.md` says.
- Stage named files only. Never stage `.claude/`, `.idea/` or `.env.local`.

## Review Focus

1. A staging setting that points at a production resource: reads as test data going into the real database. Pinned by the config test in Task 1.
2. The database being down: visitors should see a styled page, and `/api/health` should answer 503 with no details. Pinned by tests in Task 2.
3. A health or smoke check that changes data, or that reveals internals to the public. Pinned by tests in Task 2.
4. Search engines indexing staging or private pages. Pinned by tests in Task 3.
5. A backup that can't be restored: a backup counts only after a real restore. Pinned by the restore step in Task 5.

---

# Part 1: Code, done on branch `cloudflare-launch`

### Task 1: Staging and production Worker config

**Files:**
- Modify: `wrangler.jsonc`, `package.json`
- Create: `src/server/wrangler-config.test.ts`

**Interfaces:**
- Produces: `pnpm run deploy:staging`, and the bindings Part 2 fills in: `<HYPERDRIVE_ID>`, `<HYPERDRIVE_STAGING_ID>`.

- [ ] **Step 1: Write the failing test**

Read `wrangler.jsonc`, remove its comments with `/^\s*\/\/.*$/gm` (every comment in the file is on its own line) and `JSON.parse` it.

```ts
const prod = config; const staging = config.env.staging;

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
```

- [ ] **Step 2: Run it**

Run: `pnpm exec vitest run src/server/wrangler-config.test.ts`
Expected: FAIL, because `config.env` is undefined.

- [ ] **Step 3: Add the config**

In `wrangler.jsonc`, add top-level `"placement": { "region": "aws:eu-central-1" }` and an `env.staging` block. Bindings and vars aren't inherited by Wrangler environments, so `env.staging` must repeat all of them:
- `name`: `xbul-staging`
- `services`: `WORKER_SELF_REFERENCE` → `xbul-staging`
- `hyperdrive`: `HYPERDRIVE`, id `<HYPERDRIVE_STAGING_ID>`, the same `localConnectionString` as production
- `r2_buckets`: `EVIDENCE` → `xbul-evidence-staging`
- `vars`: `PUBLIC_BASE_URL` = `https://staging.xbul.ai`, `MAIL_FROM` = `xbul staging <hello@xbul.ai>`
- `observability`: `{ "enabled": true }`

In `package.json`, add:
`"deploy:staging": "node scripts/no-env-files.mjs && opennextjs-cloudflare build --env=staging && opennextjs-cloudflare deploy --env=staging"`

- [ ] **Step 4: Verify**

Run: `pnpm exec vitest run src/server/wrangler-config.test.ts`
Expected: PASS.

Run: `pnpm wrangler deploy --dry-run --env staging --outdir <scratch dir>` and the same without `--env`, using an existing `.open-next` build.
Expected: the staging run lists `xbul-evidence-staging` and `<HYPERDRIVE_STAGING_ID>`; the other lists `xbul-evidence` and `<HYPERDRIVE_ID>`; no errors. Nothing contacts an account.

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc package.json src/server/wrangler-config.test.ts
git commit -m "feat(deploy): add a staging worker and run beside the database"
```

### Task 2: Health check, outage page and live smoke check

**Files:**
- Create: `src/app/api/health/route.ts`, `src/app/api/health/route.test.ts`, `src/app/global-error.tsx`, `scripts/smoke.mjs`
- Modify: `src/shared/db/client.ts:33`

**Interfaces:**
- Consumes: `getContainer()` from `src/server/container.ts`. Follow `src/app/api/evidence/[id]/route.test.ts` for how a route test sets up the container and test database.
- Produces: `GET /api/health`, and `node scripts/smoke.mjs <origin>`, which Task 4 and Part 2 use.

- [ ] **Step 1: Write the failing tests**

```ts
test('answers ok when the database answers', async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
  expect(res.headers.get('cache-control')).toBe('no-store');
});
test('answers 503 with no details when the database fails', async () => {
  // the container's db rejects with new Error('secret-host:5432 refused')
  const res = await GET();
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain('secret-host');
  expect(res.headers.get('cache-control')).toBe('no-store');
});
```

- [ ] **Step 2: Run them**

Run: `pnpm exec vitest run src/app/api/health/route.test.ts`
Expected: FAIL, because the route doesn't exist.

- [ ] **Step 3: Implement the route**

`export async function GET(): Promise<Response>` in `route.ts`. Run `select 1` through `getContainer().db`, with `export const dynamic = 'force-dynamic'`. On failure, `console.error('[health] database check failed', e)` and answer 503 `{ "status": "unavailable" }`. It reads only: no row is written.

- [ ] **Step 4: Run them again**

Run: `pnpm exec vitest run src/app/api/health/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the outage page and quieten the pool log**

Add `src/app/global-error.tsx`, because the root layout queries the database through `getViewer`, so an outage skips `src/app/error.tsx`. Read the error-handling guide in the Next docs first. It renders its own `<html>` and `<body>`, follows `src/app/error.tsx` for wording and retry, logs the error, and shows no internals.

In `src/shared/db/client.ts:33`, log `e.message` instead of the whole error object. The Workers run logged a long object 25 times per session, which would bury real errors in Workers Logs.

- [ ] **Step 6: Write the smoke check**

`scripts/smoke.mjs` takes an origin as its argument, using `fetch` with `redirect: 'manual'`. It only reads, and it prints one line per check, exiting 1 if any fail:

| Request | Must return |
|---|---|
| `GET /` | 200, body contains `xbul` |
| `GET /sign-in` | 200 |
| `GET /api/health` | 200, `{"status":"ok"}` |
| `GET /api/evidence/00000000-0000-4000-8000-000000000000` | 404, empty body |
| `GET /admin/stats` | 307, `location` doesn't contain `/admin` |

- [ ] **Step 7: Verify**

With the dev server running: `node scripts/smoke.mjs http://localhost:3000`
Expected: every line passes, exit 0.

With nothing listening: `node scripts/smoke.mjs http://localhost:3999`
Expected: failures are printed, exit 1, no stack trace.

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/health src/app/global-error.tsx src/shared/db/client.ts scripts/smoke.mjs
git commit -m "feat(ops): add a health check, an outage page and a live smoke check"
```

### Task 3: Privacy, terms and search engine rules

**Files:**
- Create: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/robots.txt/route.ts`, `src/app/robots.txt/route.test.ts`, `e2e/legal.spec.ts`
- Modify: `src/app/_components/chrome/site-footer.tsx`, `src/app/verify/[claim]/page.tsx`

**Interfaces:**
- Consumes: `readConfig()` from `src/server/config.ts`, which gives `baseUrl`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/robots.txt/route.test.ts
test('production allows the public site and blocks private paths', async () => {
  vi.stubEnv('PUBLIC_BASE_URL', 'https://xbul.ai');
  const text = await (await GET()).text();
  expect(text).toContain('Allow: /');
  for (const path of ['/admin/', '/add', '/api/', '/verify/', '/onboarding', '/sign-in']) {
    expect(text).toContain(`Disallow: ${path}`);
  }
});
test('anywhere else blocks everything', async () => {
  vi.stubEnv('PUBLIC_BASE_URL', 'https://staging.xbul.ai');
  const text = await (await GET()).text();
  expect(text).toContain('Disallow: /');
  expect(text).not.toContain('Allow: /');
});
```

```ts
// e2e/legal.spec.ts
test('a signed-out visitor can reach privacy and terms from the footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  await expect(page.getByText('deleted', { exact: false }).first()).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible();
});
```

- [ ] **Step 2: Run them**

Run: `pnpm exec vitest run src/app/robots.txt/route.test.ts && pnpm exec playwright test e2e/legal.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement robots**

Use a route handler, `export async function GET(): Promise<Response>`, with `force-dynamic` and `text/plain`, not Next's `robots.ts`: that file is generated at build time, when the Worker has no `PUBLIC_BASE_URL`, and it must differ between environments.

- [ ] **Step 4: Write the two pages**

State what the site actually does, in plain words, with nothing beyond it.

Privacy must say:
- Account: an email address, used for sign-in links.
- Suppliers: company and contact details are public, because buyers use them.
- Evidence: invoices and similar documents are private to the supplier and admins, deleted once a claim is decided, withdrawn or changed, and in any case after 90 days.
- Searches: no IP address is stored, only a hash that changes daily.
- Backups: database backups are kept for 90 days. Evidence files aren't in them.
- Service providers: Cloudflare, Neon, Resend.
- Contact: `hello@xbul.ai`.

Terms must say:
- Suppliers are responsible for what they claim and must have the right to share what they upload.
- "Verified" means an admin reviewed the evidence, and isn't a guarantee of quality.
- Buyers and suppliers deal directly, and xbul isn't a party to their deals.
- A claim can be removed.

Show `xbul` as the operator for now. Part 2 replaces it with the legal entity before launch.

- [ ] **Step 5: Update the footer and the upload page**

The footer currently shows `About · For suppliers · Terms` as plain text. Replace that with real links to Privacy and Terms, and drop the two labels that have no page. Add one line beside the upload form in `src/app/verify/[claim]/page.tsx`, linking to `/privacy`: "Your documents stay private and are deleted once reviewed."

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm lint && pnpm typecheck && pnpm e2e`
Expected: all pass. Fix any existing spec that reads the old footer text.

- [ ] **Step 7: Commit**

```bash
git add src/app/privacy src/app/terms src/app/robots.txt src/app/_components/chrome/site-footer.tsx "src/app/verify/[claim]/page.tsx" e2e/legal.spec.ts
git commit -m "feat(app): add privacy and terms pages and search engine rules"
```

### Task 4: Automated checks and deploys

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`

**Interfaces:**
- Consumes: `pnpm run deploy:staging` (Task 1), `scripts/smoke.mjs` (Task 2).
- Produces: GitHub secrets the owner sets in Part 2: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `STAGING_DATABASE_URL`, `PRODUCTION_DATABASE_URL`.

- [ ] **Step 1: Write the workflows**

Use Node 22 and pnpm 10, install with `pnpm install --frozen-lockfile`, and pin every action to its current major version. Check each one when writing it.

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | every pull request, and callable by the deploy workflows | lint, typecheck, `pnpm test`, install Chromium, `pnpm e2e`. Upload the Playwright report and test logs on failure, so the one unexplained unit test failure seen after the Phase 2 merge can be identified if it returns. |
| `deploy-staging.yml` | push to `main` | run `ci.yml`, then `DATABASE_URL=$STAGING_DATABASE_URL pnpm db:migrate`, `pnpm run deploy:staging`, `node scripts/smoke.mjs https://staging.xbul.ai` |
| `deploy-production.yml` | `workflow_dispatch` only, `main` only, GitHub environment `production` | run `ci.yml`, then `DATABASE_URL=$PRODUCTION_DATABASE_URL pnpm db:migrate`, `pnpm run deploy`, `node scripts/smoke.mjs https://xbul.ai`. If the smoke check fails, the job fails and prints the rollback steps from `docs/runbook.md`. It doesn't roll back itself. |

Set `concurrency` on each deploy workflow so two deploys of one environment can't overlap, and `permissions: contents: read`. Secrets must not appear in commands that echo them.

- [ ] **Step 2: Check the workflows**

Run: `pnpm dlx --package=@action-validator/core --package=@action-validator/cli action-validator .github/workflows/ci.yml`, and the same for the other two.
Expected: no errors. Real runs happen in Part 2, when the repository has a GitHub remote.

Run: `pnpm e2e`, with `CI=true` set.
Expected: passes, proving the suite doesn't depend on `.env.local`. Move `.env.local` aside for this run and put it back afterwards.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows
git commit -m "ci: test every change, deploy main to staging, production by hand"
```

### Task 5: Weekly database backup and a tested restore

**Files:**
- Create: `.github/workflows/backup.yml`, `scripts/verify-restore.sh`

**Interfaces:**
- Consumes: `PRODUCTION_DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Produces: `xbul-backups/db/<YYYY-MM-DD>.dump` in R2, and `scripts/verify-restore.sh <dump file>`.

- [ ] **Step 1: Write the restore check**

`scripts/verify-restore.sh <dump file>`:
1. Start a throwaway `postgres:17` container under a unique name, and always remove it on exit.
2. Restore with `pg_restore --no-owner`.
3. Print row counts for `companies`, `claims` and `user`.
4. Exit 1 if the restore fails or `companies` has no rows.

- [ ] **Step 2: Verify it locally**

Start a throwaway Postgres, run `DATABASE_URL=<it> pnpm db:migrate` and `pnpm seed`, take a dump with `pg_dump -Fc`, then run `bash scripts/verify-restore.sh <dump>`.
Expected: exit 0, and `companies` shows the seed's 4 suppliers. Remove every container afterwards. Only stop containers you started.

- [ ] **Step 3: Write the workflow**

`backup.yml`: runs Mondays at 03:00 UTC, and by `workflow_dispatch`.
1. Run `pg_dump -Fc` with the `postgres:17` client image against `PRODUCTION_DATABASE_URL`.
2. Run `pnpm wrangler r2 object put "xbul-backups/db/$(date -u +%F).dump" --file <dump> --remote`.
3. Fail the job if the dump is empty. A failed scheduled run emails the repository owner, which is the alert.

Never upload the dump as a workflow artifact, because it holds personal data.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/backup.yml scripts/verify-restore.sh
git commit -m "feat(ops): back up the database weekly and check a restore works"
```

### Task 6: Deploy guide and runbook

**Files:**
- Modify: `docs/deploy.md`
- Create: `docs/runbook.md`

- [ ] **Step 1: Update `docs/deploy.md`**

Make it match Part 2: staging first, `--env staging` on every Wrangler command for staging, the region, Email Routing, the backups bucket, the GitHub secrets, and `/api/health` and `scripts/smoke.mjs` in the smoke test.

- [ ] **Step 2: Write `docs/runbook.md`**

It must contain:
- **Every day during launch:** check `/admin/claims` and `/admin/stats`, and look through Workers Logs for `[evidence] could not delete`, `[db]` and `[health]`.
- **Every month:** run a restore with `scripts/verify-restore.sh` on the latest dump, and compare the bills to the table in Part 2.
- **The site is down:** `node scripts/smoke.mjs https://xbul.ai`, `/api/health`, Neon's status page, Cloudflare's status page, Workers Logs, in that order.
- **A deploy went wrong:** `pnpm wrangler rollback --message "<why>"` for production, with `--env staging` for staging. Then check whether that release included a migration. The previous code must still work against the new schema, which the add-first rule guarantees.
- **Restore the database:** use Neon's instant restore for anything within 7 days, and a dump for anything older. Pause sign-ups by telling the suppliers first. Run `scripts/verify-restore.sh` on the dump before using it.
- **Rotate a secret:** `pnpm wrangler secret put <NAME>`. Rotating `BETTER_AUTH_SECRET` signs everyone out and re-counts visitor hashes once.
- **Fix a wrong company kind:** the two columns to change, `companies.kind` and `claims.scope`.
- **Change a database schema:** add first, ship, then remove in a later release.

- [ ] **Step 3: Commit**

```bash
git add docs/deploy.md docs/runbook.md
git commit -m "docs: cover staging, backups and day-to-day running"
```

---

# Part 2: Rollout, using the owner's accounts

**You** means only the owner can do it: buying, accounts, secrets. **Agent** means Claude can run it once you've signed in and said go for that stage.

Tick a stage's check before starting the next one.

### Stage 0: Decisions and purchases (You)

- [ ] Buy `xbul.ai`, or confirm you own it, and move its DNS to Cloudflare. Check the price first: `.ai` domains cost far more than `.com` and often have a minimum term.
- [ ] Decide which legal entity runs the site. Replace `xbul` as the operator on `/privacy` and `/terms`.
- [ ] Have someone qualified review both pages. The site holds customers' invoices from Turkey and Europe, so ask specifically about KVKK and GDPR.
- [ ] Create a private GitHub repository and add it as the remote (Agent can push, on your go-ahead).
- [ ] Answer your brother's open question: is Turkish needed at launch? It isn't in this plan.

**Check:** `dig NS xbul.ai` shows Cloudflare's name servers.

### Stage 1: Accounts (You)

- [ ] Cloudflare: Workers Paid; enable R2 once under **R2 Object Storage**; set a billing notification.
- [ ] Neon: `xbul-production` on Launch, with history set to 7 days, and `xbul-staging` on Free. Both in Frankfurt.
- [ ] Resend: add `xbul.ai`, add its DNS records in Cloudflare, wait for "verified". Create one API key per environment.
- [ ] Cloudflare Email Routing: forward `hello@xbul.ai` to your own inbox. Without this, replies to sign-in mail and the contact address on `/privacy` go nowhere. Check that Resend's records and these don't conflict.
- [ ] Cloudflare API token from the **Edit Cloudflare Workers** template, limited to this account. Confirm it can write to R2, because the backup job needs that.
- [ ] GitHub secrets from Task 4.
- [ ] `pnpm wrangler login` on your machine.

**Check:** `pnpm wrangler whoami` shows the right account.

### Stage 2: Staging (Agent)

Run every Wrangler command here with `--env staging`.

- [ ] `DATABASE_URL=<staging url> pnpm db:migrate`
- [ ] `pnpm wrangler hyperdrive create xbul-db-staging --connection-string=<staging url> --caching-disabled`, and paste the id over `<HYPERDRIVE_STAGING_ID>`.
- [ ] `pnpm wrangler r2 bucket create xbul-evidence-staging`, then add the 90-day lifecycle rule on `evidence/`.
- [ ] Secrets: `BETTER_AUTH_SECRET` (new, not shared with production), `RESEND_API_KEY` and `ADMIN_EMAILS` (You enter these at the prompt).
- [ ] Move `.env.local` out of the project root, run `pnpm run deploy:staging`, then put it back.
- [ ] Attach `staging.xbul.ai` as a custom domain.

**Check:** `node scripts/smoke.mjs https://staging.xbul.ai` passes, and a push to `main` deploys staging through GitHub Actions.

### Stage 3: Prove it works on staging (You and Agent)

This is the first time real Cloudflare, Neon, R2 and Resend are used together, so most surprises should appear here.

- [ ] Run the whole of step 10 in `docs/deploy.md`: sign in by email, tag a product, upload evidence, download it, sign out and see a 404, approve, see the file gone, search, see the count.
- [ ] **Product links:** paste real links from Taypa's, Fashionpoint's, Indigo Tunel's and EGR's customers' brand sites. Record how many fetch and how many need manual entry. If most fail, tell your brother before inviting anyone, because it changes how suppliers will experience adding products.
- [ ] **Upload:** a file just under 10 MB uploads, and one over 10 MB gets a clear message.
- [ ] **Speed:** open the home page, a product page and a supplier page from Turkey or over a Turkish connection, twice each, once after 10 idle minutes. Pages under about 1.5 seconds are fine. A slow first load after idling is Neon waking up. If that's a problem, turn off scale-to-zero on production, and expect the Neon bill to rise.
- [ ] **Logs:** Workers Logs show no repeating errors after all of this.
- [ ] **Rollback:** deploy a harmless change, run `pnpm wrangler rollback --env staging`, and confirm the old version answers.
- [ ] **Outage:** pause the staging database in Neon, confirm the outage page shows and `/api/health` answers 503, then resume.

**Check:** every item is done, and anything that failed is fixed or accepted by you in writing.

### Stage 4: Production (Agent, You enter secrets)

- [ ] `DATABASE_URL=<production url> pnpm db:migrate`. Never run the seed.
- [ ] `pnpm wrangler hyperdrive create xbul-db --connection-string=<production url> --caching-disabled`, and paste the id over `<HYPERDRIVE_ID>`.
- [ ] `pnpm wrangler r2 bucket create xbul-evidence`, and the 90-day rule on `evidence/`.
- [ ] `pnpm wrangler r2 bucket create xbul-backups`, and a 90-day rule on `db/`.
- [ ] Secrets, all new: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`.
- [ ] Start `deploy-production.yml` from GitHub.
- [ ] Attach `xbul.ai` as a custom domain, and redirect `www.xbul.ai` to it with a redirect rule.
- [ ] Turn on **Always Use HTTPS**.
- [ ] Add the one rate limiting rule the Free plan allows: path `/`, more than 50 requests in 10 seconds per IP, block for 10 seconds. It limits anonymous search spam and no real visitor hits it. The sign-in limiter already exists in the app.
- [ ] Start `backup.yml` by hand, download the dump, and run `scripts/verify-restore.sh` on it.
- [ ] Add `https://xbul.ai/api/health` to a free external uptime monitor, emailing you when it fails. Cloudflare can't tell you when Cloudflare itself can't reach the site.

**Check:** `node scripts/smoke.mjs https://xbul.ai` passes; step 10 of `docs/deploy.md` passes with a test supplier, which is then removed; the verified restore shows the expected tables; the monitor shows up; no bucket has a public URL.

### Stage 5: First suppliers (You)

- [ ] Add the first supplier with one person you know at Taypa, and watch them do it. Fix what confuses them.
- [ ] Then invite Fashionpoint, Indigo Tunel and EGR.
- [ ] Follow the daily list in `docs/runbook.md`. Target: 20–30 suppliers, 200–300 products, 10–20 customers searching.

### Monthly cost to expect

Check these at sign-up. Only the figures marked as checked were confirmed in current docs on 2026-10-30.

| Service | Cost | Basis |
|---|---|---|
| Cloudflare Workers Paid | $5, including Hyperdrive | Checked |
| Cloudflare R2 | $0 while under 10 GB and 1M/10M operations | Checked |
| Neon Launch | Usage only, no minimum; expect a few dollars at this size, higher without scale-to-zero | Plan terms checked, estimate isn't |
| Neon Free for staging | $0 | Checked |
| Resend | Free tier should cover sign-in links at this size | Not checked |
| GitHub, uptime monitor | $0 at this size, subject to GitHub's private-repository Actions minutes | Not checked |
| `xbul.ai` | Yearly fee | Not checked |

### Not in this plan

Decision emails, buyer accounts, ratings, paid plans, Turkish, retention for `search_events`, and load testing. The target is 10–20 customers, which won't stress any of these limits.
