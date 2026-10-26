# xmanufacture

A B2B sales and discovery site for fabric mills. A mill pastes the links of brand garments made from its fabric, adds its article code, and gets a shareable page per garment and per article. Agents forward those pages to brands, and buyers request a swatch or a quote straight from them, with the sharing agent credited. It is not a traceability tool. See the [design spec](docs/superpowers/specs/2026-10-25-xmanufacture-design.md).

## Setup

Needs Node 22.1 or later and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then set BETTER_AUTH_SECRET to 32+ random characters (openssl rand -hex 32)
pnpm db:reset                # a fresh local PGlite database in .data/dev
pnpm seed                    # demo mills, articles, garments and one request
pnpm dev                     # http://localhost:3000
```

## Demo logins

Sign-in is by magic link. Without `RESEND_API_KEY` no mail is sent: each link is printed to the dev server's console and appended to `MAIL_LOG_FILE` (`.outbox/mail.log`).

- `mill@example.test`: owner of Indigo Mill (add garments, requests inbox, edit specs)
- `agent@example.test`: agent Laura Martin, whose copied links carry `?via=lauramartin-demo`
- admin: any email listed in `ADMIN_EMAILS` (verifies original claims at `/admin/claims`)

## Tests

```bash
pnpm test    # Vitest unit tests, each on a fresh in-memory PGlite
pnpm e2e     # Playwright against a seeded dev server on :3100 (first run: pnpm exec playwright install chromium)
```

`pnpm lint` and `pnpm typecheck` check the rest.

## Structure

A Next.js modular monolith, laid out by domain-driven design:

- `src/modules/{supplier,catalog,claims,identity,inquiry,discovery}`: one bounded context each, split into `domain` (pure types and functions), `application` (use cases that take their dependencies explicitly) and `infrastructure` (Drizzle, HTTP, Better Auth). `discovery` holds the read models behind the pages.
- `src/server`: config, the per-request container and the signed-in viewer.
- `src/app`: pages and server actions. The company and user always come from the session, never from the form.
- `src/shared`: the database client, the mailer, `DomainError` and slugs.

ESLint enforces the rules:
- domain code imports nothing from Next, React, Drizzle, Better Auth or other modules
- other code reaches a module only through its `index.ts` (Drizzle `*schema` files excepted)

Errors are `DomainError` codes, which `src/app/_lib/error-messages.ts` turns into copy.

## Deploy

Cloudflare Workers with Neon Postgres behind Hyperdrive and Resend for mail. See [docs/deploy.md](docs/deploy.md).
