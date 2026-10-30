# xmanufacture

A B2B discovery site for suppliers: fabric mills first, then garment makers. A supplier pastes the links of brand products it made or can make, adds its product code, and gets a shareable page per product and per code. Buyers find the supplier behind a product and contact it directly, by email, phone or website. There are no agents and no request form. It is not a traceability tool. See the [design spec](docs/superpowers/specs/2026-10-25-xmanufacture-design.md).

## Setup

Needs Node 22.1 or later and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then set BETTER_AUTH_SECRET to 32+ random characters (openssl rand -hex 32)
pnpm db:reset                # a fresh local PGlite database in .data/dev
pnpm seed                    # demo suppliers, product codes and products
pnpm dev                     # http://localhost:3000
```

## Demo logins

Sign-in is by magic link. Without `RESEND_API_KEY` no mail is sent: each link is printed to the dev server's console and appended to `MAIL_LOG_FILE` (`.outbox/mail.log`).

- `mill@example.test`: owner of Indigo Mill, a fabric mill (add products, edit specs and contact details)
- `maker@example.test`: owner of Anka Garments, a garment maker
- admin: any email listed in `ADMIN_EMAILS` (verifies original claims at `/admin/claims`)

## Tests

```bash
pnpm test    # Vitest unit tests, each on a fresh in-memory PGlite
pnpm e2e     # Playwright against a seeded dev server on :3100 (first run: pnpm exec playwright install chromium)
```

`pnpm lint` and `pnpm typecheck` check the rest.

## Structure

A Next.js modular monolith, laid out by domain-driven design:

- `src/modules/{supplier,catalog,claims,identity,discovery}`: one bounded context each, split into `domain` (pure types and functions), `application` (use cases that take their dependencies explicitly) and `infrastructure` (Drizzle, HTTP, Better Auth). `discovery` holds the read models behind the pages.
- `src/server`: config, the per-request container and the signed-in viewer.
- `src/app`: pages and server actions. The company and user always come from the session, never from the form.
- `src/shared`: the database client, the mailer, `DomainError` and slugs.

ESLint enforces the rules:
- domain code imports nothing from Next, React, Drizzle, Better Auth or other modules
- other code reaches a module only through its `index.ts` (Drizzle `*schema` files excepted)

Errors are `DomainError` codes, which `src/app/_lib/error-messages.ts` turns into copy.

## Deploy

Cloudflare Workers with Neon Postgres behind Hyperdrive and Resend for mail. See [docs/deploy.md](docs/deploy.md).
