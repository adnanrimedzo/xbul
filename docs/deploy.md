# Deploying xmanufacture to Cloudflare Workers

xmanufacture runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare). Neon Postgres sits behind Hyperdrive, and Resend sends the mail.

You need:
- a Cloudflare account with the production domain's DNS on Cloudflare
- a Cloudflare Workers Paid plan: the free plan's CPU time (10 ms per request) and subrequest count (50 per request) are too low for rendering pages and for fetching the link previews on `/add`
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

Caching is disabled because Hyperdrive's query cache is not cleared when the app writes. The app reads right after it writes: the rate limiter, sessions and claims. Cached reads there would be stale.

## 4. Create the evidence bucket

Suppliers send invoices and similar documents in for review. They go in a private R2 bucket, bound to the worker as `EVIDENCE` in `wrangler.jsonc`. The app serves them only to the supplier who sent them and to admins, and deletes them once a claim is decided.

```bash
pnpm wrangler r2 bucket create xmanufacture-evidence
pnpm wrangler r2 bucket lifecycle add xmanufacture-evidence expire-evidence evidence/ --expire-days 90
```

Never attach a public domain or an `r2.dev` URL to this bucket.

The lifecycle rule is a backstop. The app deletes a file when its claim is decided, withdrawn or changed, but a delete can fail, and the app logs it (`[evidence] could not delete …`) without retrying. A file that is left over must not stay forever, so every object under `evidence/` expires after 90 days. The same rule also takes the files of a claim nobody got round to deciding. Their downloads then answer 404, so an admin rejects the claim with a note and the supplier uploads the documents again. A supplier who never submitted can remove the listed files and add them again.

## 5. Set the secrets

```bash
openssl rand -hex 32                      # paste this at the next prompt
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put RESEND_API_KEY
pnpm wrangler secret put ADMIN_EMAILS     # comma-separated, e.g. you@example.com
```

If the worker doesn't exist yet, Wrangler offers to create it. Answer yes.

Production refuses to start without `RESEND_API_KEY`. Without it, magic links (which are sign-in tokens) would be written to the logs. Never set `ALLOW_CONSOLE_MAILER` in production.

## 6. Verify the sending domain

1. In Resend, add the domain and create the DNS records it lists.
2. Wait until Resend shows the domain as verified.
3. Set `MAIL_FROM` in the `vars` of `wrangler.jsonc` to an address on that domain, e.g. `xmanufacture <hello@xmanufacture.com>`.

## 7. Set the public origin

In the `vars` of `wrangler.jsonc`, set `PUBLIC_BASE_URL` to the real origin, e.g. `https://xmanufacture.com`. It is the only origin setting: sign-in uses it too.

Pick either the apex or `www` and use it everywhere. Sign-in cookies and magic links are bound to one origin, so a link sent from the apex fails on `www` and the other way round. Redirect the other host to it with a Cloudflare redirect rule.

## 8. Deploy

```bash
pnpm run deploy
```

Use `pnpm run deploy`, not `pnpm deploy`. `pnpm deploy` is pnpm's own workspace command and doesn't run the script.

The project root must not contain any `.env*` file except `.env.example`, such as `.env.local`. OpenNext compiles those files into the worker, which causes two problems:
- their values, secrets included, would ship in the bundle
- a `DATABASE_URL` from them would make the worker refuse to start

`pnpm run deploy` and `pnpm preview` refuse to build while such a file is present. Move it out of the project root first.

## 9. Attach the custom domain

In the Cloudflare dashboard:
1. Open **Workers & Pages → xmanufacture → Settings → Domains & Routes**.
2. Choose **Add → Custom domain**.
3. Enter the origin from step 7.

## 10. Smoke-test

On the custom domain:
- `/` loads.
- Requesting a sign-in link delivers an email through Resend, and the link signs you in.
- On `/add`, pasting a real guess.eu product link either fetches the product or offers manual entry.
- On a declared original's **Get verified** page, uploading a PDF works and the file's link downloads it. The same link signed out answers 404.

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

3. Copy `.dev.vars.example` to `.dev.vars` and fill in a 32+ character `BETTER_AUTH_SECRET`. Wrangler reads `.dev.vars`, and OpenNext doesn't bundle it.
4. Move any `.env*` file except `.env.example` (e.g. your `.env.local` for `pnpm dev`) out of the project root. Otherwise the preview refuses to build, for the same reason as in step 8. Put it back afterwards.
5. Run `pnpm preview`, then open `http://localhost:8787`.

Magic links are printed in the preview's console.

If port 5432 is taken:
- publish the container on another port
- run `pnpm preview` with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://postgres:postgres@localhost:<port>/xmanufacture`

When you're done, remove the container with `docker rm -f xm-pg`.

## What Phase 1 does not do yet

- There are no team members or invites. There is one account per company.
- The site is in English only.
- You can't browse by brand or category.
- Brand sites that block fetching have no scraping fallback, so the supplier enters those products by hand.
- There is no PWA share target.
- There are no supplier subscriptions, paid visibility, visual search or per-article analytics.
- There is no incremental cache, because every page renders on demand.
- There is no deploy pipeline: deploys run from a developer machine with the steps above.
