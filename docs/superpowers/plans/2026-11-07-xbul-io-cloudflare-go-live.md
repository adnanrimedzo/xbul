# xbul.io Domain Move and Cloudflare Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Most tasks act on the owner's live accounts: each one marked **OWNER** is done by the owner (purchases, account creation, secrets). Each one marked **AGENT (with go-ahead)** changes a live account and needs the owner's "yes" in chat for that task before it starts.

**Goal:** Serve xbul.io from Cloudflare (DNS + Workers), with staging on `staging.xbul.io` and production on `xbul.io`, and prove sign-in, database, file storage, static files and images all work on the live addresses.

**Architecture:** The domain stays registered at one.com; only its nameservers move to Cloudflare (a free Cloudflare zone). The app is already built for this: OpenNext → Cloudflare Worker, Neon Postgres through Hyperdrive, R2 for supplier documents, Resend for sign-in mail. This plan provisions those resources, fills the two Hyperdrive ids, deploys staging, tests it end to end, then repeats for production.

**Tech Stack:** Next.js 16 + `@opennextjs/cloudflare` 1.20, Wrangler 4, Cloudflare Workers/Hyperdrive/R2/Email Routing, Neon Postgres 17, Resend, Better Auth (magic links), GitHub Actions.

**Spec:** `docs/deploy.md` (step-by-step deploy guide, binding) and `docs/superpowers/plans/2026-10-30-xbul-cloudflare-launch.md` (decisions table, binding). This plan adds the one thing those don't cover — moving the domain off one.com — and orders everything into executable tasks.

## What was found (2026-11-07, via the owner's Chrome and CLI)

| Item | State | Consequence |
|---|---|---|
| one.com | xbul.io, "Domain only", nameservers `ns01/ns02.one.com`, only default records (A apex, A www, MX) | Nothing to migrate; the default records are dropped |
| DNSSEC | **On**: `dig DS xbul.io` returns `43005 13 2 1486C8…` | Must be turned off at one.com and the DS gone from `.io` **before** the nameserver switch, or xbul.io stops resolving |
| Registration | Registrar One.com A/S, expires 2027-10-31 | Stays at one.com; registrar transfer is out of scope |
| Cloudflare account | `93481476450a4cfb820b5154d9f69b54`, has `sincapbyte.com` only | xbul.io must be added as a zone |
| Workers plan | **Free** | Upgrade to Paid ($5/mo) required (deploy.md: 10 ms CPU too low) |
| R2 | **Not enabled** (redirects to R2 plans page) | Enable before creating buckets |
| Wrangler CLI | Logged in to the same account (OAuth) | Agent can create Hyperdrive/R2/worker resources once owner approves |
| GitHub | No remote; no `xbul` repo under `gh repo list` | Needed only for Task 8 (automated deploys) |
| `wrangler.jsonc` | `<HYPERDRIVE_ID>` and `<HYPERDRIVE_STAGING_ID>` placeholders | Filled in Task 3 |
| Images | All `next/image` sources are local `.svg` (served unoptimized as static assets); product photos are hotlinked `<img>` | No Cloudflare Images (`IMAGES`) binding needed; verify no `/_next/image` requests in Task 6 |

## Global Constraints

- Production origin is exactly `https://xbul.io`; staging is exactly `https://staging.xbul.io`. `PUBLIC_BASE_URL` in `wrangler.jsonc` already says so — do not change it.
- Production and staging never share a database, bucket, secret or Worker.
- No `.env*` file except `.env.example` in the repo root when building (`scripts/no-env-files.mjs` enforces it). Use `pnpm run deploy`, never `pnpm deploy`.
- Evidence and backup buckets are never public: no custom domain, no `r2.dev` URL.
- Never run `pnpm seed` against production.
- No new runtime dependencies. No `IMAGES` binding.
- The agent never creates accounts, buys plans, or types secret values. `wrangler secret put` is run by the owner in their own terminal.
- Stage named files only. Never stage `.claude/`, `.idea/`, `.env.local`, `.dev.vars`.

## Review Focus

1. **DNSSEC left on during the nameserver switch** → resolvers see a DS that Cloudflare's zone can't satisfy, and xbul.io goes SERVFAIL for up to the DS TTL. Pinned by the `dig DS` gate in Task 2 Step 3.
2. **Magic link opens on a different origin** (`www.xbul.io`, workers.dev, http) → sign-in silently fails. Pinned by the www redirect and Always-HTTPS checks in Task 6/7.
3. **Resend domain not verified, or Email Routing MX conflicts with Resend's MX** → no sign-in mail. Pinned by Task 4 Step 4 (both verified) and the sign-in test in Task 6.
4. **Staging pointing at a production resource** → test data in the real DB. Pinned by Task 3 Step 5 (`wrangler-config.test.ts` passes with real ids).
5. **Staging indexed by search engines** → pinned by the robots check added to `scripts/smoke.mjs` in Task 5.

---

### Task 1: Account prerequisites — OWNER

**Files:** none.

- [ ] **Step 1:** Cloudflare → Compute → Workers plans → **Upgrade** to Paid ($5/month). Then Account → Billing → add a billing notification.
- [ ] **Step 2:** Cloudflare → Storage & databases → **R2 Object Storage** → enable (Free tier is enough; needs the payment method from Step 1).
- [ ] **Step 3:** Create a Neon account; create projects `xbul-staging` (Free) and `xbul-production` (Launch), Postgres 17, region `aws-eu-central-1`. On production set history retention to 7 days. Keep both **unpooled** connection strings in your password manager.
- [ ] **Step 4:** Create a Resend account (domain added in Task 4).
- [ ] **Step 5:** Run `pnpm wrangler login` once more (wrangler reports missing scopes `k2.read/k2.write`; refreshing avoids surprises).

Done when: Workers plans page shows **Paid** as current plan, and opening R2 shows the bucket list instead of the plans page.

### Task 2: Move xbul.io DNS from one.com to Cloudflare — AGENT (with go-ahead) + OWNER clicks at one.com

**Files:** Modify `docs/deploy.md` (add a "0. Move the domain to Cloudflare" section before "1. Create the databases" recording Steps 1–6 below, so the guide no longer assumes DNS is already on Cloudflare).

- [ ] **Step 1: Add the zone.** Cloudflare → Domains → **Onboard a domain** → `xbul.io` → **Free** plan. Record the two assigned nameservers (`<name>.ns.cloudflare.com`).
- [ ] **Step 2: Clean the imported records.** Delete the imported one.com A (apex, www) and MX records. The zone should be empty except what later tasks add. (Nothing is hosted at one.com, so nothing breaks.)
- [ ] **Step 3: Turn off DNSSEC at one.com and wait for the DS to clear.** one.com → Domain → DNS settings → Nameservers → **DNSSEC** tab → disable. Then poll:
  Run: `dig +short DS xbul.io @a0.nic.io`
  Expected: empty output. Then wait a further 2 hours (the DS TTL) before Step 4. **Do not proceed while the DS is still returned.**
- [ ] **Step 4: Switch nameservers.** one.com → Nameservers → **Change to custom nameservers** → enter the two Cloudflare nameservers from Step 1 → Save.
- [ ] **Step 5: Wait for activation.**
  Run: `dig +short NS xbul.io @a0.nic.io`
  Expected: the two `*.ns.cloudflare.com` names. Then Cloudflare → xbul.io overview shows **Active** (click "Check nameservers now" to speed up; usually < 1 h, up to 24 h).
- [ ] **Step 6: Re-enable DNSSEC through Cloudflare.** Cloudflare → xbul.io → DNS → Settings → **Enable DNSSEC** → copy the DS values → one.com → Nameservers → **DS Records** tab → add them. Verify:
  Run: `dig +short DS xbul.io` → Cloudflare's DS (algorithm 13); `dig +dnssec xbul.io SOA` shows the `ad` flag via a validating resolver (`dig @1.1.1.1 +dnssec xbul.io SOA | grep flags`).
- [ ] **Step 7: Zone settings.** SSL/TLS mode **Full (strict)**; Edge Certificates → **Always Use HTTPS** on, minimum TLS 1.2.
- [ ] **Step 8: Commit** `docs/deploy.md` — `docs: add moving xbul.io's DNS from one.com to Cloudflare`.

### Task 3: Provision staging and production resources — AGENT (with go-ahead) + OWNER secrets

**Files:** Modify `wrangler.jsonc` (the two Hyperdrive ids). Test: existing `src/server/wrangler-config.test.ts`.

**Interfaces:**
- Produces: Hyperdrive configs `xbul-db-staging`, `xbul-db`; R2 buckets `xbul-evidence-staging`, `xbul-evidence`, `xbul-backups`; Worker secrets `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS` on `xbul-staging` and `xbul`.

- [ ] **Step 1: Migrate both databases** (owner pastes the URL into their own terminal): `DATABASE_URL="<neon url>" pnpm db:migrate`, once per database. Expected: drizzle reports all migrations applied, exit 0.
- [ ] **Step 2: Hyperdrive** — exactly the two commands in `docs/deploy.md` step 3 (`--caching-disabled --update-config=false`). The connection string contains a password, so the **owner** runs these; the agent reads the printed ids.
- [ ] **Step 3: R2** — the agent runs the five commands in `docs/deploy.md` step 4 (both evidence buckets with the 90-day `evidence/` lifecycle, `xbul-backups` with the 90-day `db/` lifecycle). Verify: `pnpm wrangler r2 bucket list` shows all three; `pnpm wrangler r2 bucket lifecycle list xbul-evidence` shows `expire-evidence`.
- [ ] **Step 4: Fill the ids** — replace `<HYPERDRIVE_ID>` and `<HYPERDRIVE_STAGING_ID>` in `wrangler.jsonc` with the ids from Step 2.
- [ ] **Step 5: Run the config test.** Run: `pnpm vitest run src/server/wrangler-config.test.ts` → PASS (staging and production use different Hyperdrive ids and buckets).
- [ ] **Step 6: Secrets — OWNER**, per `docs/deploy.md` step 5, staging then production: a new `openssl rand -hex 32` per environment for `BETTER_AUTH_SECRET`, one Resend key per environment (created in Task 4 Step 1), `ADMIN_EMAILS=adnanrimedzo@gmail.com` (or the owner's choice). Verify (agent): `pnpm wrangler secret list --env staging` and `pnpm wrangler secret list` each list the three names.
- [ ] **Step 7: Commit** `wrangler.jsonc` — `chore(deploy): add the Hyperdrive ids for staging and production`.

### Task 4: Email — AGENT (with go-ahead) for DNS, OWNER in Resend

**Files:** none.

- [ ] **Step 1 (OWNER):** Resend → Domains → add `mail.xbul.io` (region EU; sending subdomain, replies via Reply-To `hello@xbul.io`). Create API keys `xbul-staging` and `xbul-production` (sending access, this domain only) — used in Task 3 Step 6.
- [ ] **Step 2:** Add Resend's records in Cloudflare DNS exactly as Resend lists them (DKIM TXT `resend._domainkey.mail`, CNAMEs `rsend.mail` and `send.mail`; skip the receiving MX). All **DNS only** (grey cloud).
- [ ] **Step 3:** Cloudflare → xbul.io → Email → **Email Routing** → enable (it adds apex MX + SPF TXT for `xbul.io`) → verify the destination address `adnanrimedzo@gmail.com` (OWNER clicks the verification mail) → route `hello@xbul.io` to it. Resend's records live under `mail.xbul.io`, Email Routing's on the apex, so they don't conflict; confirm there is exactly one SPF TXT on the apex.
- [ ] **Step 4: Verify.** Resend shows the domain **Verified**; Email Routing shows **Configured**. Send a mail from another account to `hello@xbul.io` → it arrives in Gmail.

### Task 5: Extend the live smoke check to cover static files, images and headers

**Files:** Modify `scripts/smoke.mjs`.

The current checks cover home, sign-in, `/api/health` (DB), private-file 404 and the admin redirect. Add, as entries in the same `checks` array (same `[name, path, passes]` shape):

- `['logo (static file)', '/logos/xbul-logo-white.svg', res => res.status === 200 && content-type includes 'image/svg+xml']`
- `['page refuses framing', '/', res => res.headers.get('x-frame-options') === 'DENY']`
- `['robots rules', '/robots.txt', async res => res.status === 200 && (origin === 'https://xbul.io') === !(await res.text()).includes('Disallow: /\n')]` — production allows crawling, every other origin disallows all. (Match the exact output of `src/app/robots.txt/route.ts`.)
- One check that fetches `/`, extracts the first `/_next/static/…\.js` path from the HTML, and expects it to answer 200 with `cache-control` containing `immutable`. Implement as a check whose `path` is `/` and whose `passes` does a second `fetch(new URL(match, origin))`.

- [ ] **Step 1:** Build and run locally against the Workers runtime: follow `docs/deploy.md` "Checking the Workers build locally" (Docker Postgres, `.dev.vars`, `pnpm preview`), then run `node scripts/smoke.mjs http://localhost:8787`.
  Expected before the change: 5 `ok`. After the change: 9 `ok` (robots expects "disallow all" because the origin isn't `https://xbul.io`).
- [ ] **Step 2:** Break one deliberately (request `/logos/missing.svg`) and confirm the script prints `FAILED` and exits 1; revert.
- [ ] **Step 3:** In the same local preview, sign in with a magic link printed in the console, open `/add`, upload a PDF on a test supplier's **Get verified** page, download it, and check DevTools Network shows no `/_next/image` requests. This proves auth, Hyperdrive-style Postgres access, R2 (local) and static assets in workerd before touching the cloud.
- [ ] **Step 4:** `pnpm lint && pnpm typecheck && pnpm test` → all pass.
- [ ] **Step 5: Commit** `scripts/smoke.mjs` — `feat(ops): smoke-check static files, framing header and robots rules`.

### Task 6: Deploy staging and test every function — AGENT (with go-ahead)

**Files:** none.

- [ ] **Step 1:** `pnpm run deploy:staging` → wrangler prints the uploaded version id for `xbul-staging`.
- [ ] **Step 2:** Workers & Pages → `xbul-staging` → Settings → Domains & Routes → **Add custom domain** `staging.xbul.io`. Wait until the certificate is active.
- [ ] **Step 3:** Run: `node scripts/smoke.mjs https://staging.xbul.io` → all 9 `ok`.
- [ ] **Step 4: Full manual pass** (agent drives the owner's Chrome; owner reads the sign-in mail). Each line must pass:

| Area | Check | Pass when |
|---|---|---|
| Auth | Request a sign-in link for the admin address | Mail from `xbul staging <hello@mail.xbul.io>` arrives, Reply-To `hello@xbul.io`; link opens on `https://staging.xbul.io` and signs in |
| Auth | Reuse the same link | Refused (single-use) |
| Auth | Sign out, open `/admin/claims` | Redirected away from `/admin` |
| Auth | Request 6+ links quickly | App's sign-in rate limiter refuses |
| DB | `/api/health` | `{"status":"ok"}` |
| DB | Search a product link on `/` as visitor, then `/admin/stats` | **Searches** +1 |
| Link fetch | `/add` with a real brand product URL | Product details fetched, or manual entry offered |
| Images | Product page from that link | Hotlinked photo loads with credit; a broken URL shows the xbul mark placeholder; no `/_next/image` requests |
| Static | Logos, favicon, fonts, CSS | No 404s in DevTools Network; `/_next/static/*` served with `immutable` |
| R2 | Test supplier → **Get verified** → upload PDF → download | File downloads; same URL signed out → 404 |
| R2 | Submit for review → admin approves → confirm | Product shows **Verified**; file URL now 404 (deleted from bucket — confirm in R2 dashboard) |
| Robots | `/robots.txt` | Disallows everything |
| Errors | `/does-not-exist` | Styled 404 page |
| Logs | Workers & Pages → `xbul-staging` → Logs | Requests visible, no uncaught exceptions |

- [ ] **Step 5:** Remove the test product; keep the test supplier until Task 7 Step 5 is done on production.

### Task 7: Deploy production and test — AGENT (with go-ahead)

**Files:** none.

- [ ] **Step 1:** `pnpm run deploy` → version id for `xbul`.
- [ ] **Step 2:** Add custom domain `xbul.io` to worker `xbul`. Add a proxied `AAAA www → 100::` record and a redirect rule: hostname equals `www.xbul.io` → `https://xbul.io${path}` (dynamic, 301, preserve query).
- [ ] **Step 3:** `node scripts/smoke.mjs https://xbul.io` → all `ok` (robots now allows crawling).
- [ ] **Step 4:** Run: `curl -sI https://www.xbul.io/sign-in` → `301` with `location: https://xbul.io/sign-in`; `curl -sI http://xbul.io/` → `301` to `https://`.
- [ ] **Step 5:** Repeat the Task 6 Step 4 table on `https://xbul.io` with a test supplier (mail now from `xbul <hello@mail.xbul.io>`).
- [ ] **Step 6:** WAF → Rate limiting rule from `docs/deploy.md` step 12 (path `/`, >50 req / 10 s per IP, block 10 s).
- [ ] **Step 7:** Add `https://xbul.io/api/health` to an external uptime monitor (e.g. UptimeRobot free) that emails the owner — OWNER creates that account.

### Task 8: Automated deploys and backups — OWNER (repo + secrets), AGENT (with go-ahead) for the rest

**Files:** none (workflows already exist in `.github/workflows/`).

- [ ] **Step 1:** Create a **private** GitHub repo `xbul` and push `main` (agent may run `gh repo create xbul --private --source . --push` after the owner says yes).
- [ ] **Step 2 (OWNER):** Add Actions secrets `CLOUDFLARE_API_TOKEN` (Edit Cloudflare Workers template + R2 write + Hyperdrive edit, this account only), `CLOUDFLARE_ACCOUNT_ID=93481476450a4cfb820b5154d9f69b54`, `STAGING_DATABASE_URL`, `PRODUCTION_DATABASE_URL`; create environment `production`.
- [ ] **Step 3:** Push a no-op commit to `main` → `Deploy staging` goes green including its smoke step.
- [ ] **Step 4:** Start `Deploy production` by hand → green.
- [ ] **Step 5:** Start `Back up the database` → dump appears in `xbul-backups`; owner downloads it and runs `bash scripts/verify-restore.sh <dump>` → passes. Then delete the downloaded dump and the production test supplier (runbook "Delete a supplier or a user").

---

## Rollback

- Before Task 2 Step 4: nothing live changed — just delete the Cloudflare zone.
- After the nameserver switch: set one.com back to "one.com nameservers (default)"; never re-add a DS that doesn't match the active nameservers.
- Bad deploy: `pnpm wrangler rollback` (production) / `--env staging`; see `docs/runbook.md` "A deploy went wrong".

## Cost

Workers Paid $5/mo; Neon Launch usage-based (staging Free); R2, Hyperdrive, Email Routing, DNS zone: free at this size; Resend free tier (3,000 mails/mo).
