# Deploying xmanufacture to Cloudflare Workers

xmanufacture runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare). Neon Postgres sits behind Hyperdrive, and Resend sends the mail.

You need:
- a Cloudflare account with the production domain's DNS on Cloudflare
- a Neon account
- a Resend account

Every command runs from the repository root. Sign in to Cloudflare once with `pnpm wrangler login`.

## 1. Create the database

Create a Neon project and copy its connection string. Turn Neon's connection pooling off, because Hyperdrive does the pooling. The string looks like `postgresql://user:password@ep-….neon.tech/neondb?sslmode=require`.

## 2. Apply the migrations

```bash
DATABASE_URL="<neon url>" pnpm db:migrate
```

Run this again before you deploy any code that adds a migration in `drizzle/`. Do not run `pnpm seed` against production, because it loads demo data.

## 3. Create the Hyperdrive config

```bash
pnpm wrangler hyperdrive create xmanufacture-db --connection-string="<neon url>" --caching-disabled
```

Paste the printed `id` over `<HYPERDRIVE_ID>` in `wrangler.jsonc`.

Caching is disabled because Hyperdrive's query cache is not cleared when the app writes. The app reads right after it writes: the rate limiter, sessions, claims and the requests inbox. Cached reads there would be stale.

## 4. Set the secrets

```bash
openssl rand -hex 32                      # paste this at the next prompt
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put RESEND_API_KEY
pnpm wrangler secret put ADMIN_EMAILS     # comma-separated, e.g. you@example.com
```

If the worker doesn't exist yet, Wrangler offers to create it. Answer yes.

Production refuses to start without `RESEND_API_KEY`. Without it, magic links (which are sign-in tokens) would be written to the logs. Never set `ALLOW_CONSOLE_MAILER` in production.

## 5. Verify the sending domain

1. In Resend, add the domain and create the DNS records it lists.
2. Wait until Resend shows the domain as verified.
3. Set `MAIL_FROM` in the `vars` of `wrangler.jsonc` to an address on that domain, e.g. `xmanufacture <hello@xmanufacture.com>`.

## 6. Set the public origin

In the `vars` of `wrangler.jsonc`, set both `PUBLIC_BASE_URL` and `BETTER_AUTH_URL` to the real origin, e.g. `https://xmanufacture.com`.

Pick either the apex or `www` and use it everywhere. Sign-in cookies and magic links are bound to one origin, so a link sent from the apex fails on `www` and the other way round. Redirect the other host to it with a Cloudflare redirect rule.

## 7. Deploy

```bash
pnpm run deploy
```

Use `pnpm run deploy`, not `pnpm deploy`. `pnpm deploy` is pnpm's own workspace command and doesn't run the script.

Before you deploy, make sure there is no `.env`, `.env.local` or `.env.production` file in the checkout. OpenNext copies those files into the worker, which causes two problems:
- their values would ship in the bundle
- a `DATABASE_URL` from them would override Hyperdrive

## 8. Attach the custom domain

In the Cloudflare dashboard:
1. Open **Workers & Pages → xmanufacture → Settings → Domains & Routes**.
2. Choose **Add → Custom domain**.
3. Enter the origin from step 6.

## 9. Smoke-test

On the custom domain:
- `/` loads.
- Requesting a sign-in link delivers an email through Resend, and the link signs you in.
- On `/add`, pasting a real guess.eu product link either fetches the product or offers manual entry.

## Checking the Workers build locally (optional)

1. Start Postgres in Docker:

   ```bash
   docker run -d --name xm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=xmanufacture -p 5432:5432 postgres:17
   ```

2. Migrate and seed it:

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/xmanufacture pnpm db:migrate
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/xmanufacture pnpm seed
   ```

3. Copy `.dev.vars.example` to `.dev.vars` and fill in a 32+ character `BETTER_AUTH_SECRET`.
4. Run `pnpm preview`, then open `http://localhost:8787`.

Magic links are printed in the preview's console.

If port 5432 is taken:
- publish the container on another port
- run `pnpm preview` with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://postgres:postgres@localhost:<port>/xmanufacture`

When you're done, remove the container with `docker rm -f xm-pg`.

## What Phase 1 does not do yet

- Verification has no proof upload: an admin approves claims by hand.
- There are no team members or invites. There is one account per company.
- The site is in English only.
- Garment makers are not yet a company kind.
- You can't browse by brand or category.
- Brand sites that block fetching have no scraping fallback, so the mill enters those products by hand.
- There is no PWA share target.
- There are no mill subscriptions, paid visibility, visual search or per-article analytics.
- There is no incremental cache, because every page renders on demand.
- There is no deploy pipeline: deploys run from a developer machine with the steps above.
