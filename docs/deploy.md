# Deploying xbul to Cloudflare Workers

xbul runs on Cloudflare Workers through [OpenNext](https://opennext.js.org/cloudflare). Neon Postgres sits behind Hyperdrive, R2 holds supplier documents, and Resend sends the mail. For running the live site, see [runbook.md](runbook.md).

There are two environments that share nothing. **Do every step for staging first, then repeat it for production.**

| | Staging | Production |
|---|---|---|
| Address | `https://staging.xbul.io` | `https://xbul.io` |
| Worker | `xbul-staging` | `xbul` |
| Neon project | `xbul-staging` (Free plan) | `xbul-production` (Launch plan) |
| Hyperdrive config | `xbul-db-staging` | `xbul-db` |
| Document bucket | `xbul-evidence-staging` | `xbul-evidence` |
| Wrangler flag | `--env staging` | none |
| Deploy command | `pnpm run deploy:staging` | `pnpm run deploy` |

You need:
- a Cloudflare account with `xbul.io`'s DNS on Cloudflare (step 0)
- a Cloudflare Workers Paid plan: the free plan's CPU time (10 ms per request) and subrequest count (50 per request) are too low for rendering pages and for fetching the link previews on `/add`
- R2 enabled on that account. Do this once in the Cloudflare dashboard, under **R2 Object Storage**. Step 4 fails until you have.
- a Neon account
- a Resend account
- a private GitHub repository for this code
- Node.js 22.1 or newer, pnpm 10, and Docker for checking backups

Every command runs from the repository root. Install the dependencies once, then sign in to Cloudflare:

```bash
pnpm install
pnpm wrangler login
```

## 0. Move the domain to Cloudflare

`xbul.io` is registered at one.com and stays there. Only its DNS moves to Cloudflare. Do this once, before step 9 needs it.

1. In Cloudflare, open **Domains → Onboard a domain**, enter `xbul.io` and choose the Free plan. Note the two `….ns.cloudflare.com` nameservers it gives you.
2. Delete the A and MX records Cloudflare copied from one.com. Nothing is hosted at one.com, so nothing breaks.
3. At one.com, open **Domain → DNS settings → Nameservers → DNSSEC** and turn DNSSEC off. Then wait until `dig +short DS xbul.io @a0.nic.io` prints nothing, and two hours more. If you switch nameservers while the old DS record is still published, xbul.io stops resolving.
4. At one.com, under **Nameservers**, choose **Change to custom nameservers**, enter the two Cloudflare nameservers and save.
5. Wait until `dig +short NS xbul.io @a0.nic.io` prints the Cloudflare nameservers and Cloudflare shows the domain as **Active**.
6. In Cloudflare, open **DNS → Settings → Enable DNSSEC**, then add the DS record it shows at one.com under **Nameservers → DS Records**.
7. Set **SSL/TLS** to **Full (strict)**, and turn on **Always Use HTTPS** with minimum TLS 1.2.

To undo it, set one.com back to its own nameservers. Never leave a DS record at one.com that doesn't match the nameservers in use.

## 1. Create the databases

Create the Neon projects in the table above. Choose Postgres 17 and the Frankfurt region (`aws-eu-central-1`). The worker is placed next to that region through `placement` in `wrangler.jsonc`, so change both together if you ever move the database.

Copy each project's connection string, with Neon's connection pooling turned off, because Hyperdrive does the pooling. The string looks like `postgresql://user:password@ep-….neon.tech/neondb?sslmode=require`.

On `xbul-production`, set the history window to 7 days, the most the Launch plan allows. That is how far back an instant restore reaches.

## 2. Apply the migrations

```bash
DATABASE_URL="<neon url>" pnpm db:migrate
```

After step 11, GitHub Actions does this before each deploy. New migrations must still work with the previous version of the code, because a rollback doesn't undo them: add first, and remove in a later release.

Never run `pnpm seed` against production, because it loads demo data.

## 3. Create the Hyperdrive configs

```bash
pnpm wrangler hyperdrive create xbul-db-staging --connection-string="<staging neon url>" --caching-disabled --update-config=false
pnpm wrangler hyperdrive create xbul-db --connection-string="<production neon url>" --caching-disabled --update-config=false
```

`--update-config=false` here and in step 4 stops Wrangler offering to add the new resource to `wrangler.jsonc`, where it would end up on the wrong worker.

Paste each printed `id` into `wrangler.jsonc`: `<HYPERDRIVE_STAGING_ID>` for staging and `<HYPERDRIVE_ID>` for production. These ids aren't secret, so commit them.

Caching is disabled because Hyperdrive's query cache is not cleared when the app writes. The app reads right after it writes: the rate limiter, sessions and claims. Cached reads there would be stale.

## 4. Create the buckets

Suppliers send invoices and similar documents in for review. They go in a private R2 bucket, bound to the worker as `EVIDENCE` in `wrangler.jsonc`. The app serves them only to the supplier who sent them and to admins, and deletes them once a claim is decided.

```bash
pnpm wrangler r2 bucket create xbul-evidence-staging --update-config=false
pnpm wrangler r2 bucket lifecycle add xbul-evidence-staging expire-evidence evidence/ --expire-days 90
pnpm wrangler r2 bucket create xbul-evidence --update-config=false
pnpm wrangler r2 bucket lifecycle add xbul-evidence expire-evidence evidence/ --expire-days 90
```

Weekly database backups go in their own bucket, for production only. They hold personal data, so they expire too:

```bash
pnpm wrangler r2 bucket create xbul-backups --update-config=false
pnpm wrangler r2 bucket lifecycle add xbul-backups expire-backups db/ --expire-days 90
```

Never attach a public domain or an `r2.dev` URL to any of these buckets.

The evidence lifecycle rule is a backstop. The app deletes a file when its claim is decided, withdrawn or changed, but a delete can fail, and the app logs it (`[evidence] could not delete …`) without retrying. A file that is left over must not stay forever, so every object under `evidence/` expires after 90 days. The same rule also takes the files of a claim nobody got round to deciding. Their downloads then answer 404, so an admin rejects the claim with a note and the supplier uploads the documents again. A supplier who never submitted can remove the listed files and add them again.

## 5. Set the secrets

Use different values in each environment. Generate a new `BETTER_AUTH_SECRET` for each, and create one Resend key per environment.

```bash
openssl rand -hex 32                                    # paste this at the next prompt
pnpm wrangler secret put BETTER_AUTH_SECRET --env staging
pnpm wrangler secret put RESEND_API_KEY --env staging
pnpm wrangler secret put ADMIN_EMAILS --env staging     # comma-separated, e.g. you@example.com
```

Repeat without `--env staging` for production. If a worker doesn't exist yet, Wrangler offers to create it. Answer yes.

Production refuses to start without `RESEND_API_KEY`. Without it, magic links (which are sign-in tokens) would be written to the logs. Never set `ALLOW_CONSOLE_MAILER` on a deployed worker.

## 6. Set up email

Mail is sent from the subdomain `mail.xbul.io`, so a sending problem can't hurt the reputation of `xbul.io` itself. Replies go to `hello@xbul.io` through a Reply-To header.

1. In Resend, add `mail.xbul.io` in the Ireland (`eu-west-1`) region, and create the DNS records it lists in Cloudflare as **DNS only**: the DKIM TXT record and the two CNAMEs. Skip Resend's MX record, which is only for receiving mail. Keep one `_dmarc.xbul.io` TXT record (`v=DMARC1; p=none;`); it covers the subdomain too.
2. Wait until Resend shows the domain as verified. Sign-in doesn't work until then.
3. In Cloudflare, open **Email → Email Routing** for `xbul.io` and forward `hello@xbul.io` to your own inbox. Sign-in mail gives it as the Reply-To, and `/privacy` and `/terms` give it as the contact, so replies must reach you. Email Routing's records sit on `xbul.io` and Resend's on `mail.xbul.io`, so they don't conflict.

`MAIL_FROM` is already set in `wrangler.jsonc`.

## 7. Check the public address

`PUBLIC_BASE_URL` in `wrangler.jsonc` is already `https://xbul.io` for production and `https://staging.xbul.io` for staging. It is the only origin setting: sign-in uses it too, and `/robots.txt` blocks all search engines unless it is exactly `https://xbul.io`.

The `workers.dev` address and version preview addresses are turned off in `wrangler.jsonc`, so a worker can't be reached until step 9 gives it a custom domain.

Sign-in cookies and magic links are bound to one origin, so a link sent from `xbul.io` fails on `www.xbul.io`. Step 9 redirects `www`.

## 8. Deploy

```bash
pnpm run deploy:staging   # or: pnpm run deploy
```

Use `pnpm run deploy`, not `pnpm deploy`. `pnpm deploy` is pnpm's own workspace command and doesn't run the script.

The project root must not contain any `.env*` file except `.env.example`, such as `.env.local`. OpenNext compiles those files into the worker, which causes two problems:
- their values, secrets included, would ship in the bundle
- a `DATABASE_URL` from them would make the worker refuse to start

The deploy and preview scripts refuse to build while such a file is present. Move it out of the project root first, and put it back afterwards.

## 9. Attach the custom domain

In the Cloudflare dashboard:
1. Open **Workers & Pages → xbul-staging** (or **xbul**) **→ Settings → Domains & Routes**.
2. Choose **Add → Custom domain**.
3. Enter the address from the table above.

For production, also:
- Redirect `www.xbul.io` to `https://xbul.io` with a Cloudflare redirect rule.
- Turn on **SSL/TLS → Edge Certificates → Always Use HTTPS**.

## 10. Smoke-test

First the read-only check, which also runs after every automated deploy:

```bash
node scripts/smoke.mjs https://staging.xbul.io
```

Then by hand, on the same address:
- `/` loads.
- Requesting a sign-in link delivers an email through Resend, and the link signs you in.
- On `/add`, pasting a real product link either fetches the product or offers manual entry.
- Use a test supplier for the rest, because approving a claim makes its **Verified** badge public. On `/add`, publish the product as **We made this**. On the company page, its **Get verified** link opens the upload page.
- On the **Get verified** page, uploading a PDF works and the file's link downloads it. The same link signed out answers 404.
- Click **Submit for review**. Then sign in as an admin (an address in `ADMIN_EMAILS`) and open `/admin/claims`. The claim is listed, and the file's link downloads.
- Click **Approve**, then **Confirm approve**. The product page now shows **Verified**, and the file's link answers 404, because approving deletes the documents.
- Remove the test product from the supplier's page when you're done. Keep the test supplier for now: on production, step 12's backup check needs at least one company. After that, delete it with **Delete a supplier or a user** in [runbook.md](runbook.md).
- On `/`, search for a product link. Then open `/admin/stats` as an admin: **Searches** has gone up by one.

## 11. Turn on automated deploys

Push this repository to your private GitHub repository. In **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A token from the **Edit Cloudflare Workers** template, limited to this account. Confirm it can write to R2, because the backup job needs that. If the first deploy reports a permission error on Hyperdrive, add Hyperdrive edit permission to the token. |
| `CLOUDFLARE_ACCOUNT_ID` | Shown on the Workers overview page |
| `STAGING_DATABASE_URL` | The staging Neon connection string |
| `PRODUCTION_DATABASE_URL` | The production Neon connection string |

Under **Settings → Environments**, create one called `production`.

What then runs:

| Workflow | When | What it does |
|---|---|---|
| `CI` | Every pull request | Lint, types, unit tests, browser tests |
| `Deploy staging` | Every push to `main` | CI, migrations, deploy, smoke check |
| `Deploy production` | Only when you start it under **Actions** | CI, migrations, deploy, smoke check. It doesn't roll back on failure: see [runbook.md](runbook.md). |
| `Back up the database` | Mondays at 03:00 UTC, or when you start it | Dumps production to `xbul-backups`. A failed run emails the repository owner. |

## 12. Protect and watch production

- **Check the first backup.** While the test supplier from step 10 still exists, start `Back up the database` by hand, download the dump from the `xbul-backups` bucket in the dashboard, then run `bash scripts/verify-restore.sh <dump file>`. A database with no companies fails this check on purpose. Delete the downloaded file afterwards.
- **Uptime monitor.** Add `https://xbul.io/api/health` to a free external uptime monitor that emails you. It has to be outside Cloudflare, so it can tell you when Cloudflare can't reach the site.
- **Rate limit.** Under **Security → WAF → Rate limiting rules**, add the one rule the Free plan allows: path equals `/`, more than 50 requests in 10 seconds per IP, block for 10 seconds. It limits anonymous search spam, and no real visitor reaches it. Sign-in has its own limiter in the app.
- **Billing.** Set a billing notification in Cloudflare and Neon.

## Checking the Workers build locally (optional)

1. Start Postgres in Docker:

   ```bash
   docker run -d --name xm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=xbul -p 5432:5432 postgres:17
   ```

2. Migrate and seed it:

   ```bash
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/xbul pnpm db:migrate
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/xbul pnpm seed
   ```

3. Copy `.dev.vars.example` to `.dev.vars` and fill in a 32+ character `BETTER_AUTH_SECRET`. Wrangler reads `.dev.vars`, and OpenNext doesn't bundle it.
4. Move any `.env*` file except `.env.example` (e.g. your `.env.local` for `pnpm dev`) out of the project root. Otherwise the preview refuses to build, for the same reason as in step 8. Put it back afterwards.
5. Run `pnpm preview`, then open `http://localhost:8787`.

Magic links are printed in the preview's console.

If port 5432 is taken:
- publish the container on another port
- run `pnpm preview` with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://postgres:postgres@localhost:<port>/xbul`

When you're done, remove the container with `docker rm -f xm-pg`.

## What the site does not do yet

- There are no team members or invites. There is one account per company.
- The site is in English only.
- You can't browse by brand or category.
- Brand sites that block fetching have no scraping fallback, so the supplier enters those products by hand.
- There is no PWA share target.
- There are no buyer accounts and no ratings. Buyers search and contact suppliers without signing in.
- There are no supplier subscriptions, paid visibility or visual search.
- There are no analytics for suppliers. The only figures are the platform-wide counts an admin sees on `/admin/stats`.
- There is no email when a claim is submitted or decided. Admins check `/admin/claims`, and suppliers see the result on their page.
- There is no incremental cache, because every page renders on demand.
