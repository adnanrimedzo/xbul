# xmanufacture Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of xmanufacture. Mills paste brand garment links and tag each one as *our fabric* or *equivalent*. Every garment and article gets a public, shareable page with link previews. Buyers request swatches or quotes, and the agent who shared the link is credited. An admin verifies original claims. The whole thing is deployed to Cloudflare.

**Architecture:** One Next.js 16 App Router app, structured as a modular monolith. Six bounded contexts live under `src/modules/` (supplier, catalog, claims, identity, inquiry, discovery). Each has a pure `domain/`, use-case functions in `application/` that take explicit dependencies, and Drizzle/HTTP/email code in `infrastructure/`, behind a public `index.ts`. `src/server/` is the composition root (container, viewer, seed). `src/app/` is presentation only. PGlite backs dev and tests; production uses Postgres (Neon via Cloudflare Hyperdrive).

**Tech Stack:** Next.js 16.4 · React 19 · TypeScript (strict) · Tailwind CSS 4 · Drizzle ORM 0.45 / drizzle-kit 0.31 · PGlite 0.5 (dev/test) · `pg` 8 (prod) · Better Auth 1.7 (magic link) · Resend 6 · Zod 4 · node-html-parser 9 · Vitest 5 · Playwright 1.64 · tsx · @opennextjs/cloudflare 1.20 · Wrangler 4 · pnpm 10 · Node ≥ 22 (local: 25.2)

**Spec:** `docs/superpowers/specs/2026-10-25-xmanufacture-design.md`. The visual reference is `docs/design/mockup-pages-v1.html`.

## Global Constraints

- **Next 16:** `params`, `searchParams`, `cookies()` and `headers()` are **async**. Always `await` them. Middleware is called `proxy.ts` (Phase 1 doesn't use it).
- **Domain purity:** files in `src/modules/*/domain/**` import nothing from `next`, `react`, `drizzle-orm`, `better-auth`, `@/server`, `@/app` or other modules. ESLint enforces this (Task 1).
- **Module boundaries:** code outside a module imports only `@/modules/<name>` (its `index.ts`). The single exception is `@/modules/<name>/infrastructure/*schema` (Drizzle tables), which other modules' infrastructure, `discovery` and `src/server/**` may import. Inside a module, use relative imports.
- **Domain objects:** readonly types plus pure functions. No classes, except `DomainError`.
- **Use cases:** `async function name(deps: {...}, input: {...}): Promise<T>`. Dependencies are passed explicitly; there's no DI container library.
- **Errors:** domain and application code throws `DomainError(code)` with dotted codes such as `company.name_invalid`. Server actions map codes to English text in `src/app/_lib/error-messages.ts`.
- **Company from the server:** every company-scoped write takes `companyId` / `userId` from the server-side viewer, never from form data.
- **IDs:** UUID v4 from `crypto.randomUUID()`. URLs use slugs for companies and articles, and UUIDs for products.
- **Limits:**
  - 50 links per paste
  - claim note ≤ 280 characters
  - inquiry message ≤ 2000 characters
  - 5 inquiries per buyer email per company per 24h
  - product page fetch: 8000 ms timeout, 2,000,000 byte cap
  - magic link expires in 600 s
- **Product photos:** hotlink the brand's image URL with `<img referrerPolicy="no-referrer">`. **Never download or store image bytes.** Credit every photo as `PHOTO: <HOST> ↗`, linking to `sourceUrl`.
- **Design tokens:**
  - font Space Grotesk 400/500/600/700
  - `ink #000000`, `paper #FFFFFF`, `accent #F0721F`, `muted #707070`
  - 1px solid black lines between bands
  - **no border-radius, no shadows**
  - UI text uppercase via CSS (copy is written in normal case)
  - grid is 3 columns, dropping to 2 below 760px
- **Copy:** English only in Phase 1.
- **Tests:** colocated `*.test.ts` (Vitest). Tests that touch the database call `await createTestDb()` (a fresh in-memory PGlite with all migrations applied). End-to-end tests live in `e2e/*.spec.ts` (Playwright) and run against the seeded demo data.
- **Commits:** one per task, conventional style (`feat(supplier): …`), and every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A brand site blocks the fetch or returns a non-product page** (Zara-style anti-bot, cookie wall). The row should ask for brand and name by hand, and publishing should still work. Tests: Task 5 `importProduct … needs_details`, Task 14 e2e for the blocked row.
2. **The same garment is pasted twice, or with tracking parameters, a `www.` or a trailing slash.** It should become one product with one claim per mill. Tests: Task 4 canonicalization table, Task 6 duplicate items in one batch, Task 15 e2e pasting a URL with `utm_source`.
3. **An article code is typed with stray spaces, lowercase, or a slash** (`" 60219/1 "`, `60219-1`). It should map to the same article with a URL-safe slug, and the colliding slug gets a `-2` suffix. Tests: Task 3.
4. **Two mills both claim "original" on one garment.** Both should show as declared originals and neither gets hidden. Verifying one blocks verifying the other, in both the use case and the database. Tests: Task 6, plus Task 16 e2e.
5. **The `?via=` handle is unknown or tampered with** (`?via=<script>`). The inquiry should be saved with no agent credit, and nothing should render unescaped. Tests: Task 8 and Task 12 e2e.

Security that isn't up for debate (tested in its own task): server-side fetching of user-supplied URLs rejects private and loopback hosts (Task 4).

---

### Task 1: Repository bootstrap and module boundaries

**Files:**
- Create (create-next-app): `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/{layout.tsx,page.tsx,globals.css}`
- Create: `vitest.config.ts`, `.env.example`
- Modify: `.gitignore`, `eslint.config.mjs`, `package.json` (scripts)

**Interfaces:**
- Produces: the scripts `test`, `test:watch`, `typecheck`, `lint`, `db:generate`, `db:migrate`, `db:reset`, `seed`, `e2e`, and the alias `@/*` → `src/*` (TypeScript and Vitest).

- [ ] **Step 1: Initialise git and scaffold Next.js in a temp folder, then move it up** (create-next-app refuses a folder that already contains `.superpowers/`)

```bash
cd /Users/adnanrimedzo/projects/personal/xmanufacture
git init
pnpm create next-app@latest .tmp-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --disable-git --skip-install --yes
rsync -a .tmp-app/ ./ && rm -rf .tmp-app && pnpm install
```

- [ ] **Step 2: Add dependencies**

```bash
pnpm add drizzle-orm @electric-sql/pglite pg better-auth zod node-html-parser resend
pnpm add -D drizzle-kit vitest @playwright/test @types/pg tsx
pnpm exec playwright install chromium
```

- [ ] **Step 3: Add scripts to `package.json`**

`"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."`, `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:reset": "rm -rf .data/dev && drizzle-kit migrate"`, `"seed": "tsx scripts/seed.ts"`, `"e2e": "playwright test"`.

- [ ] **Step 4: Create `vitest.config.ts`**

`include: ['src/**/*.test.ts']`, `environment: 'node'`, `passWithNoTests: true`, and `resolve.alias` `'@'` → `fileURLToPath(new URL('./src', import.meta.url))`.

- [ ] **Step 5: Append to `.gitignore`**

`.superpowers/`, `.data/`, `.outbox/`, `.open-next/`, `.wrangler/`, `.dev.vars`, `test-results/`, `playwright-report/`, plus `!.env.example` (create-next-app already ignores `.env*`).

- [ ] **Step 6: Create `.env.example`**

```dotenv
DATABASE_URL=./.data/dev            # a path → PGlite; postgres://… → Postgres
BETTER_AUTH_SECRET=replace-with-32+-random-chars
BETTER_AUTH_URL=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:3000
ADMIN_EMAILS=you@example.com        # comma-separated
RESEND_API_KEY=                     # empty → console mailer
MAIL_FROM=xmanufacture <hello@xmanufacture.com>
MAIL_LOG_FILE=.outbox/mail.log
FETCH_ALLOW_PRIVATE_HOSTS=0
```

- [ ] **Step 7: Add the boundary rules to `eslint.config.mjs`** (exact patterns below; append after the Next presets)

```js
const deepImport = { group: ['@/modules/*/*', '!@/modules/*/infrastructure/*schema'], message: 'Import a module through its index.ts' };
// ...
{ files: ['src/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', { patterns: [deepImport] }] } },
{ files: ['src/modules/*/domain/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: [deepImport,
  { group: ['next', 'next/*', 'react', 'react-dom', 'drizzle-orm', 'drizzle-orm/*', 'better-auth', 'better-auth/*', '@/modules/*', '@/server/*', '@/app/*'], message: 'Domain stays pure' }] }] } },
```

(The domain block repeats `deepImport` because a later config overrides the rule entirely.)

- [ ] **Step 8: Prove the domain rule bites**

Create `src/modules/x/domain/bad.ts` containing `import 'drizzle-orm';`. Run `pnpm lint`.
Expected: FAIL with "Domain stays pure". Then delete `src/modules/x`.

- [ ] **Step 9: Verify the toolchain**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. Vitest reports "No test files found, exiting with code 0".

- [ ] **Step 10: Commit** (this includes `docs/` with the spec, plan and mockup)

```bash
git add -A
git commit -m "chore: bootstrap Next.js app with DDD module boundaries"
```

---

### Task 2: Shared kernel, database harness, mailer

**Files:**
- Create: `src/shared/domain/{ids.ts,errors.ts,slug.ts,slug.test.ts}`
- Create: `src/shared/db/{client.ts,testing.ts,testing.test.ts}`
- Create: `src/shared/mail/{mailer.ts,mailer.test.ts,testing.ts}`
- Create: `drizzle.config.ts`, `drizzle/0000_init.sql` (generated)

**Interfaces:**
- Produces:
  - `newId(): string`
  - `class DomainError extends Error { readonly code: string; constructor(code: string, message?: string) }`
  - `slugify(input: string): string`
  - `type Db = PgDatabase<PgQueryResultHKT>`, plus `createDb(url: string): Db` and `createTestDb(): Promise<Db>`
  - `type MailMessage = { to: string; subject: string; text: string }` and `interface Mailer { send(m: MailMessage): Promise<void> }`
  - `createConsoleMailer(logFile?: string): Mailer`, `createResendMailer(apiKey: string, from: string): Mailer`, `createRecordingMailer(): Mailer & { sent: MailMessage[] }`

- [ ] **Step 1: Write the failing slug test** (`src/shared/domain/slug.test.ts`)

```ts
it.each([
  ['ÇORLU DENIM WORKS', 'corlu-denim-works'],
  ['  Işık Tekstil A.Ş. ', 'isik-tekstil-a-s'],
  ['60219/1', '60219-1'],
  ['Ğüşöç İ', 'gusoc-i'],
  ['///', ''],
])('slugify(%j) → %j', (input, expected) => expect(slugify(input)).toBe(expected));
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm test src/shared/domain`. Expected: FAIL (`slugify` not found).

- [ ] **Step 3: Implement `ids.ts`, `errors.ts` and `slug.ts`**

`slugify` steps:
1. Map Turkish letters first: `ç→c ğ→g ı→i İ→i ö→o ş→s ü→u`, with uppercase forms too.
2. Apply `normalize('NFKD')` and strip combining marks.
3. Lowercase.
4. Replace runs of non-`[a-z0-9]` with `-`, then trim `-` from both ends.

- [ ] **Step 4: Run it and check it passes**

Run: `pnpm test src/shared/domain`. Expected: PASS.

- [ ] **Step 5: Create `drizzle.config.ts`**

- `dialect: 'postgresql'`
- `schema: './src/modules/*/infrastructure/*schema.ts'`
- `out: './drizzle'`
- `url = process.env.DATABASE_URL ?? './.data/dev'`
- If `url` starts with `postgres`, use `dbCredentials: { url }`. Otherwise use `driver: 'pglite', dbCredentials: { url }`.

- [ ] **Step 6: Create the baseline migration** (the migrator needs a journal before any module schema exists)

Run: `pnpm drizzle-kit generate --custom --name=init`, then put `SELECT 1;` in `drizzle/0000_init.sql`.

- [ ] **Step 7: Write the failing DB harness test** (`src/shared/db/testing.test.ts`)

```ts
it('creates a migrated in-memory database', async () => {
  const db = await createTestDb();
  const res = await db.execute(sql`select 1 as one`);
  expect(res.rows[0]).toEqual({ one: 1 });
});
```

- [ ] **Step 8: Implement `client.ts` and `testing.ts`**

`createDb(url)`:
- For `postgres…` URLs: `drizzle({ client: new Pool({ connectionString: url, max: 5 }) })` from `drizzle-orm/node-postgres`.
- Otherwise: a PGlite at directory `url`, memoised on `globalThis.__xmPglite` (a `Map<string, Db>`) so dev hot-reload reuses one instance.

`createTestDb()`:
- `drizzle({ client: new PGlite() })`, then `migrate(db, { migrationsFolder: 'drizzle' })` from `drizzle-orm/pglite/migrator`.

A cast `as unknown as Db` is acceptable only inside these two functions.

- [ ] **Step 9: Write the failing mailer test** (`src/shared/mail/mailer.test.ts`)

```ts
it('console mailer appends a JSON line per message', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'xm-')), 'out', 'mail.log');
  await createConsoleMailer(file).send({ to: 'a@b.test', subject: 'Hi', text: 'Body' });
  expect(JSON.parse(readFileSync(file, 'utf8').trim())).toMatchObject({ to: 'a@b.test', subject: 'Hi', text: 'Body' });
});
it('recording mailer keeps sent messages', async () => {
  const m = createRecordingMailer(); await m.send({ to: 'x@y.test', subject: 's', text: 't' });
  expect(m.sent).toHaveLength(1);
});
```

- [ ] **Step 10: Implement the mailers**

- **Console:** `console.info` the message. If `logFile` is given, `mkdir -p` its folder and append `JSON.stringify({ ...m, at: new Date().toISOString() }) + '\n'`.
- **Resend:** `new Resend(apiKey).emails.send({ from, to, subject, text })`, and throw if the response contains `error`.
- **Recording:** lives in `testing.ts`.

- [ ] **Step 11: Run all tests**

Run: `pnpm test`. Expected: PASS (3 files).

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "feat(shared): kernel, db harness, mailer"
```

---

### Task 3: Supplier context (Company, Article)

**Files:**
- Create: `src/modules/supplier/domain/{company.ts,company.test.ts,article.ts,article.test.ts,repositories.ts}`
- Create: `src/modules/supplier/application/{register-company.ts,upsert-article.ts,edit-article-specs.ts,supplier.test.ts}`
- Create: `src/modules/supplier/infrastructure/{schema.ts,drizzle-repositories.ts}`, `src/modules/supplier/index.ts`
- Create: `drizzle/0001_supplier.sql` (generated)

**Interfaces:**
- Consumes: `newId`, `slugify`, `DomainError`, `Db`, `createTestDb` (Task 2)
- Produces, exported from `@/modules/supplier`:
  - `type Company = Readonly<{ id: string; slug: string; name: string; kind: 'fabric_mill'; city: string; country: string; ownerUserId: string; createdAt: Date }>`
  - `type ArticleSpecs = Readonly<{ weightOz: number | null; composition: string | null; finish: string | null; moqMeters: number | null; leadTimeWeeks: number | null }>`
  - `type Article = Readonly<{ id: string; companyId: string; code: string; slug: string; specs: ArticleSpecs; createdAt: Date }>`
  - `createCompany(input: { name: string; city: string; country: string; ownerUserId: string }, now?: Date): Company`
  - `normalizeArticleCode(raw: string): string`, `createArticle(input: { companyId: string; code: string }, now?: Date): Article`, `withSpecs(a: Article, specs: Partial<ArticleSpecs>): Article`
  - `interface CompanyRepository { save(c: Company): Promise<void>; findById(id: string): Promise<Company | null>; findBySlug(slug: string): Promise<Company | null>; findByOwner(userId: string): Promise<Company | null>; slugExists(slug: string): Promise<boolean> }`
  - `interface ArticleRepository { save(a: Article): Promise<void>; findById(id: string): Promise<Article | null>; findByCode(companyId: string, code: string): Promise<Article | null>; slugExists(companyId: string, slug: string): Promise<boolean> }`
  - `registerCompany(deps: { companies: CompanyRepository }, input: { name: string; city: string; country: string; ownerUserId: string }): Promise<Company>`
  - `upsertArticle(deps: { articles: ArticleRepository }, input: { companyId: string; code: string }): Promise<Article>`
  - `editArticleSpecs(deps: { articles: ArticleRepository; companies: CompanyRepository }, input: { userId: string; articleId: string; specs: Partial<ArticleSpecs> }): Promise<Article>`
  - `createSupplierRepositories(db: Db): { companies: CompanyRepository; articles: ArticleRepository }`
  - Tables `companies` and `articles` (from `infrastructure/schema.ts`)

- [ ] **Step 1: Write the failing domain tests** (`company.test.ts`, `article.test.ts`)

```ts
it('creates a company with trimmed name, slug and upper-case country', () => {
  const c = createCompany({ name: '  Indigo Mill ', city: 'Istanbul', country: 'tr', ownerUserId: 'u1' });
  expect(c).toMatchObject({ name: 'Indigo Mill', slug: 'indigo-mill', country: 'TR', kind: 'fabric_mill' });
});
it.each([[{ name: 'A' }, 'company.name_invalid'], [{ country: 'TUR' }, 'company.country_invalid'], [{ city: '' }, 'company.city_invalid']])(
  'rejects %j', (patch, code) => expect(() => createCompany({ name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', ...patch }))
    .toThrow(expect.objectContaining({ code })));

it.each([[' 60219/1 ', '60219/1'], [' ab  12 ', 'AB 12']])('normalizes %j', (raw, code) => expect(normalizeArticleCode(raw)).toBe(code));
it('rejects empty or >40-char codes', () => {
  expect(() => normalizeArticleCode('  ')).toThrow(expect.objectContaining({ code: 'article.code_invalid' }));
  expect(() => normalizeArticleCode('x'.repeat(41))).toThrow(expect.objectContaining({ code: 'article.code_invalid' }));
});
it('slugs the code and starts with empty specs', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(a).toMatchObject({ code: '60219/1', slug: '60219-1', specs: { weightOz: null, moqMeters: null } });
});
it('validates specs', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(withSpecs(a, { moqMeters: 1000, weightOz: 12.5, composition: ' 98% CO 2% EA ', finish: '' }).specs)
    .toEqual({ moqMeters: 1000, weightOz: 12.5, composition: '98% CO 2% EA', finish: null, leadTimeWeeks: null });
  expect(() => withSpecs(a, { moqMeters: 0 })).toThrow(expect.objectContaining({ code: 'article.moq_invalid' }));
  expect(() => withSpecs(a, { leadTimeWeeks: 2.5 })).toThrow(expect.objectContaining({ code: 'article.lead_time_invalid' }));
  expect(() => withSpecs(a, { weightOz: 41 })).toThrow(expect.objectContaining({ code: 'article.weight_invalid' }));
});
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm test src/modules/supplier/domain`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `company.ts`, `article.ts` and `repositories.ts`**

Rules:
- **Company:** name trimmed, 2–80 characters. City trimmed, 1–60 characters. Country is trimmed, uppercased, and must match `/^[A-Z]{2}$/`.
- **Article code:** trim, collapse internal whitespace, uppercase, 1–40 characters.
- **Specs:**
  - `weightOz` from 1 to 40
  - `moqMeters` an integer from 1 to 1,000,000
  - `leadTimeWeeks` an integer from 0 to 52
  - `composition` up to 120 characters and `finish` up to 80, otherwise `article.text_too_long`
  - blank strings become `null`

- [ ] **Step 4: Run them and check they pass**

Run: `pnpm test src/modules/supplier/domain`. Expected: PASS.

- [ ] **Step 5: Write `infrastructure/schema.ts` and generate the migration**

- `companies`: `id uuid pk`, `slug text unique`, `name text`, `kind text default 'fabric_mill'`, `city text`, `country char(2)`, `owner_user_id text unique`, `created_at timestamptz default now()`.
- `articles`: `id uuid pk`, `company_id uuid → companies.id on delete cascade`, `code text`, `slug text`, `weight_oz double precision`, `composition text`, `finish text`, `moq_meters integer`, `lead_time_weeks integer`, `created_at timestamptz`. Two unique indexes: `(company_id, code)` and `(company_id, slug)`.

Run: `pnpm db:generate --name=supplier`. Expected: `drizzle/0001_supplier.sql` is created.

- [ ] **Step 6: Write the failing application tests** (`application/supplier.test.ts`, each test with its own `createTestDb()`)

```ts
it('registers one company per owner', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1' });
  await expect(registerCompany(repos, { name: 'Other', city: 'Bursa', country: 'TR', ownerUserId: 'u1' }))
    .rejects.toMatchObject({ code: 'company.already_registered' });
});
it('suffixes colliding company slugs', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const a = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1' });
  const b = await registerCompany(repos, { name: 'INDIGO MILL', city: 'Izmir', country: 'TR', ownerUserId: 'u2' });
  expect([a.slug, b.slug]).toEqual(['indigo-mill', 'indigo-mill-2']);
});
it('upserts articles by normalized code and suffixes colliding slugs', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1' });
  const a1 = await upsertArticle(repos, { companyId: c.id, code: ' 60219/1' });
  const a2 = await upsertArticle(repos, { companyId: c.id, code: '60219/1' });
  const a3 = await upsertArticle(repos, { companyId: c.id, code: '60219-1' });
  expect(a2.id).toBe(a1.id);
  expect([a1.slug, a3.slug]).toEqual(['60219-1', '60219-1-2']);
});
it('only the owner edits specs', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Indigo Mill', city: 'Istanbul', country: 'TR', ownerUserId: 'u1' });
  const a = await upsertArticle(repos, { companyId: c.id, code: '60219/1' });
  await expect(editArticleSpecs(repos, { userId: 'u2', articleId: a.id, specs: { moqMeters: 10 } })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect((await editArticleSpecs(repos, { userId: 'u1', articleId: a.id, specs: { moqMeters: 1500 } })).specs.moqMeters).toBe(1500);
});
```

- [ ] **Step 7: Run them and check they fail**

Run: `pnpm test src/modules/supplier/application`. Expected: FAIL.

- [ ] **Step 8: Implement the repositories (`save` = insert on conflict(id) do update), the three use cases and `index.ts`**

- Slug suffixes count up `-2`, `-3`, … while `slugExists`.
- A missing article throws `article.not_found`.

- [ ] **Step 9: Run them and check they pass**

Run: `pnpm test src/modules/supplier`. Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(supplier): company and article aggregates"
```

---

### Task 4: Catalog domain — URL canonicalization, public-host guard, page parser

**Files:**
- Create: `src/modules/catalog/domain/{product-url.ts,product-url.test.ts,product.ts,product.test.ts}`
- Create: `src/modules/catalog/infrastructure/{parse-product-page.ts,parse-product-page.test.ts}`

**Interfaces:**
- Consumes: `DomainError`, `newId` (Task 2)
- Produces:
  - `canonicalizeProductUrl(raw: string): string` (throws `product.url_invalid`)
  - `parseHttpUrl(raw: string): URL` (throws `product.url_invalid` for anything that isn't http or https)
  - `assertPublicHttpUrl(url: URL, opts: { allowPrivateHosts: boolean }): void` (throws `product.url_not_public`)
  - `brandFromHost(host: string): string`
  - `type Product = Readonly<{ id: string; canonicalUrl: string; sourceUrl: string; brand: string; name: string; imageUrl: string | null; composition: string | null; createdAt: Date }>`
  - `createProduct(input: Omit<Product, 'id' | 'createdAt'>, now?: Date): Product`
  - `type ProductSnapshot = { brand: string; name: string; imageUrl: string | null; composition: string | null }`
  - `parseProductPage(html: string, pageUrl: string): ProductSnapshot | null`

- [ ] **Step 1: Write the failing URL tests** (`product-url.test.ts`)

```ts
it.each([
  ['https://www.guess.eu/en/blazer-W5RN12?utm_source=wa&color=blue#top', 'https://guess.eu/en/blazer-W5RN12?color=blue'],
  ['http://ZARA.com/tr/jacket-p0123.html/', 'https://zara.com/tr/jacket-p0123.html'],
  ['https://liujo.com/it/x?b=2&a=1&gclid=z&fbclid=y&srsltid=q', 'https://liujo.com/it/x?a=1&b=2'],
  ['https://mango.com/', 'https://mango.com/'],
])('canonicalizes %s', (raw, canon) => expect(canonicalizeProductUrl(raw)).toBe(canon));
it.each(['ftp://x.com/a', 'not a url', 'javascript:alert(1)'])('rejects %s', raw =>
  expect(() => canonicalizeProductUrl(raw)).toThrow(expect.objectContaining({ code: 'product.url_invalid' })));

it.each(['http://localhost:3000/x', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://172.20.0.1/', 'http://192.168.0.5/',
  'http://169.254.169.254/latest', 'http://[::1]/', 'http://[fd00::1]/', 'http://printer.local/', 'http://0.0.0.0/'])(
  'blocks private host %s', raw => expect(() => assertPublicHttpUrl(new URL(raw), { allowPrivateHosts: false }))
    .toThrow(expect.objectContaining({ code: 'product.url_not_public' })));
it('allows public hosts, and private ones when allowed', () => {
  expect(() => assertPublicHttpUrl(new URL('https://guess.eu/x'), { allowPrivateHosts: false })).not.toThrow();
  expect(() => assertPublicHttpUrl(new URL('http://localhost:4010/x'), { allowPrivateHosts: true })).not.toThrow();
});
it.each([['guess.eu', 'GUESS'], ['www.liujo.com', 'LIUJO'], ['shop.mango.com', 'MANGO'], ['zara.co.uk', 'ZARA'], ['lcwaikiki.com.tr', 'LCWAIKIKI']])(
  'brandFromHost(%s)', (host, brand) => expect(brandFromHost(host)).toBe(brand));
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm test src/modules/catalog/domain`. Expected: FAIL.

- [ ] **Step 3: Implement `product-url.ts`**

**Canonical form:**
- https scheme, lowercase host with no `www.`, no hash
- strip the query keys `utm_*`, `gclid`, `fbclid`, `srsltid`, `_ga`, `mc_*`, `ref`
- sort the remaining keys
- drop the trailing `/` unless the path is `/`

**Private-host check** (the `URL` hostname, brackets stripped):
- `localhost`, `*.local`, `*.internal`
- IPv4 `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`
- IPv6 `::1`, `fc00::/7`, `fe80::/10`

Add the comment `// ponytail: no DNS resolution, so rebinding isn't covered; Workers' global_fetch_strictly_public covers prod`.

**`brandFromHost`:** take the registrable label. If the second-to-last label is one of `co`, `com`, `net`, `org` and the last label is 2 letters, use the label before those two. Uppercase the result.

- [ ] **Step 4: Write the failing product and parser tests**

```ts
// product.test.ts
it('validates brand and name, and drops non-http images', () => {
  const p = createProduct({ canonicalUrl: 'https://guess.eu/x', sourceUrl: 'https://guess.eu/x', brand: ' GUESS ', name: ' Blazer ', imageUrl: 'data:image/png;base64,AA', composition: null });
  expect(p).toMatchObject({ brand: 'GUESS', name: 'Blazer', imageUrl: null });
  expect(() => createProduct({ ...p, brand: '' })).toThrow(expect.objectContaining({ code: 'product.brand_invalid' }));
  expect(() => createProduct({ ...p, name: 'x'.repeat(161) })).toThrow(expect.objectContaining({ code: 'product.name_invalid' }));
});

// parse-product-page.test.ts
const jsonLd = `<html><head><meta property="og:title" content="Ignored | GUESS">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
{"@type":"Product","name":"Cropped Denim Blazer","brand":{"@type":"Brand","name":"GUESS"},"image":["/img/b1.jpg","/img/b2.jpg"],"material":"100% Cotton"}]}</script></head></html>`;
const ogOnly = `<html><head><script type="application/ld+json">{bad json</script>
<meta property="og:title" content="Printed denim jacket | LIU-JO"><meta property="og:image" content="https://cdn.liujo.com/a.jpg">
<meta property="og:site_name" content="Liu Jo"></head></html>`;
it('prefers JSON-LD Product and resolves relative images', () =>
  expect(parseProductPage(jsonLd, 'https://guess.eu/en/x')).toEqual({ brand: 'GUESS', name: 'Cropped Denim Blazer', imageUrl: 'https://guess.eu/img/b1.jpg', composition: '100% Cotton' }));
it('falls back to Open Graph, survives bad JSON-LD, strips the brand suffix', () =>
  expect(parseProductPage(ogOnly, 'https://liujo.com/it/x')).toEqual({ brand: 'Liu Jo', name: 'Printed denim jacket', imageUrl: 'https://cdn.liujo.com/a.jpg', composition: null }));
it('falls back to <title> and the host brand', () =>
  expect(parseProductPage('<title>Trucker Jacket</title>', 'https://www.armani.com/x')).toEqual({ brand: 'ARMANI', name: 'Trucker Jacket', imageUrl: null, composition: null }));
it('returns null without a name', () => expect(parseProductPage('<html><title> </title></html>', 'https://x.com/')).toBeNull());
```

- [ ] **Step 5: Run them and check they fail**

Run: `pnpm test src/modules/catalog`. Expected: FAIL.

- [ ] **Step 6: Implement `product.ts` and `parse-product-page.ts`**

**`createProduct`:** brand 1–60 characters and name 1–160 after trimming. `imageUrl` is kept only if it is http or https.

**`parseProductPage`** (using `node-html-parser`), in this order:
1. **JSON-LD:** read every `script[type="application/ld+json"]` (skip on parse error). Walk arrays and `@graph`, and take the first `@type` equal to or containing `Product`. Read:
   - `name`
   - `brand` (a string or `.name`)
   - `image` (a string, the first array item, or `.url`)
   - `material` as `composition`
2. **Open Graph:** `og:title`, `og:image`, then `product:brand` or `og:site_name`.
3. **`<title>`.**

Brand falls back to `brandFromHost`. Strip a trailing ` | X` or ` - X` from the name when `X`, with non-alphanumerics removed and lowercased, equals the brand or the host brand normalized the same way. Resolve the image against `pageUrl`. Return `null` if there's no name.

- [ ] **Step 7: Run them and check they pass**

Run: `pnpm test src/modules/catalog`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(catalog): url canonicalization, private-host guard, product page parser"
```

---

### Task 5: Catalog application and persistence

**Files:**
- Create: `src/modules/catalog/domain/repositories.ts`, `src/modules/catalog/application/{ports.ts,import-product.ts,add-product-manually.ts,find-product.ts,catalog.test.ts}`
- Create: `src/modules/catalog/infrastructure/{schema.ts,drizzle-product-repository.ts,http-product-page-fetcher.ts,http-product-page-fetcher.test.ts}`, `src/modules/catalog/index.ts`
- Create: `drizzle/0002_catalog.sql` (generated)

**Interfaces:**
- Consumes: everything from Task 4, plus `Db` and `createTestDb` (Task 2)
- Produces, exported from `@/modules/catalog`:
  - `Product`, `ProductSnapshot`, `canonicalizeProductUrl`
  - `interface ProductRepository { save(p: Product): Promise<void>; findById(id: string): Promise<Product | null>; findByCanonicalUrl(url: string): Promise<Product | null> }`
  - `interface ProductPageFetcher { fetchHtml(url: string): Promise<string> }` (throws on any failure)
  - `type ImportResult = { status: 'ok'; product: Product } | { status: 'needs_details'; url: string; canonicalUrl: string; reason: 'fetch_failed' | 'not_a_product_page' }`
  - `importProduct(deps: { products: ProductRepository; fetcher: ProductPageFetcher; allowPrivateHosts: boolean }, rawUrl: string): Promise<ImportResult>`
  - `addProductManually(deps: { products: ProductRepository; allowPrivateHosts: boolean }, input: { url: string; brand: string; name: string }): Promise<Product>`
  - `findProductByUrl(deps: { products: ProductRepository }, rawUrl: string): Promise<Product | null>` (an invalid URL gives `null`)
  - `getProduct(deps: { products: ProductRepository }, id: string): Promise<Product | null>`
  - `createProductRepository(db: Db): ProductRepository`
  - `createHttpProductPageFetcher(opts?: { timeoutMs?: number; maxBytes?: number }): ProductPageFetcher`
  - Table `products`

- [ ] **Step 1: Write `schema.ts` and generate the migration**

`products`: `id uuid pk`, `canonical_url text unique`, `source_url text`, `brand text`, `name text`, `image_url text`, `composition text`, `created_at timestamptz default now()`.

Run: `pnpm db:generate --name=catalog`.

- [ ] **Step 2: Write the failing use-case tests** (`application/catalog.test.ts`)

```ts
const html = `<script type="application/ld+json">{"@type":"Product","name":"Cropped Denim Blazer","brand":"GUESS","image":"https://img.guess.eu/b.jpg"}</script>`;
const fetcherReturning = (body: string | Error) => { const calls: string[] = []; return { calls, fetchHtml: async (u: string) => { calls.push(u); if (body instanceof Error) throw body; return body; } }; };

it('imports once and dedupes tracking-param variants', async () => {
  const products = createProductRepository(await createTestDb()); const fetcher = fetcherReturning(html);
  const a = await importProduct({ products, fetcher, allowPrivateHosts: false }, 'https://www.guess.eu/en/b-1');
  const b = await importProduct({ products, fetcher, allowPrivateHosts: false }, 'https://guess.eu/en/b-1/?utm_source=wa');
  expect(a).toMatchObject({ status: 'ok', product: { brand: 'GUESS', name: 'Cropped Denim Blazer', sourceUrl: 'https://www.guess.eu/en/b-1' } });
  expect(b.status === 'ok' && a.status === 'ok' && b.product.id === a.product.id).toBe(true);
  expect(fetcher.calls).toHaveLength(1);
});
it('asks for details when the fetch fails or the page is not a product', async () => {
  const products = createProductRepository(await createTestDb());
  expect(await importProduct({ products, fetcher: fetcherReturning(new Error('403')), allowPrivateHosts: false }, 'https://zara.com/p1'))
    .toEqual({ status: 'needs_details', url: 'https://zara.com/p1', canonicalUrl: 'https://zara.com/p1', reason: 'fetch_failed' });
  expect(await importProduct({ products, fetcher: fetcherReturning('<html></html>'), allowPrivateHosts: false }, 'https://zara.com/p2'))
    .toMatchObject({ status: 'needs_details', reason: 'not_a_product_page' });
  expect(await products.findByCanonicalUrl('https://zara.com/p1')).toBeNull();
});
it('never fetches private hosts', async () => {
  const fetcher = fetcherReturning(html);
  await expect(importProduct({ products: createProductRepository(await createTestDb()), fetcher, allowPrivateHosts: false }, 'http://169.254.169.254/latest'))
    .rejects.toMatchObject({ code: 'product.url_not_public' });
  expect(fetcher.calls).toHaveLength(0);
});
it('adds manually and finds by any URL variant', async () => {
  const products = createProductRepository(await createTestDb());
  const p = await addProductManually({ products, allowPrivateHosts: false }, { url: 'https://zara.com/tr/overshirt-p9', brand: 'ZARA', name: 'Black Denim Overshirt' });
  expect((await findProductByUrl({ products }, 'https://www.zara.com/tr/overshirt-p9/'))?.id).toBe(p.id);
  expect(await findProductByUrl({ products }, 'not a url')).toBeNull();
});
```

- [ ] **Step 3: Run them and check they fail**

Run: `pnpm test src/modules/catalog/application`. Expected: FAIL.

- [ ] **Step 4: Implement the repository, ports, use cases and `index.ts`**

**`importProduct`** order:
1. `parseHttpUrl`
2. canonicalize
3. look for an existing product; if found, return `ok`
4. `assertPublicHttpUrl`
5. fetch (catch → `fetch_failed`)
6. parse (`null` → `not_a_product_page`)
7. `createProduct` with `sourceUrl` = the raw URL, then save

**`addProductManually`:** returns the existing product if there is one. Otherwise it runs the same validation and calls `createProduct` with `imageUrl: null` and `composition: null`.

- [ ] **Step 5: Write the failing fetcher test** (`http-product-page-fetcher.test.ts`)

It uses a real `node:http` server on port 0 that serves `/ok` (html), `/404` and `/big` (3 MB html).

```ts
it('returns html, rejects non-2xx and oversize bodies', async () => {
  const f = createHttpProductPageFetcher({ timeoutMs: 2000, maxBytes: 2_000_000 });
  expect(await f.fetchHtml(`${base}/ok`)).toContain('<title>');
  await expect(f.fetchHtml(`${base}/404`)).rejects.toThrow();
  await expect(f.fetchHtml(`${base}/big`)).rejects.toThrow(/too large/i);
});
```

- [ ] **Step 6: Implement the fetcher**

- `fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'Mozilla/5.0 (compatible; xmanufacture-bot/1.0; +https://xmanufacture.com/bot)', accept: 'text/html', 'accept-language': 'en' } })`
- Throw on `!res.ok` or a non-html `content-type`.
- Read the body stream with a byte counter and throw `Error('too large')` past `maxBytes`.

- [ ] **Step 7: Run all tests**

Run: `pnpm test src/modules/catalog`. Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(catalog): import products from links with manual fallback"
```

---

### Task 6: Claims context

**Files:**
- Create: `src/modules/claims/domain/{claim.ts,claim.test.ts,rank-claims.ts,rank-claims.test.ts,repositories.ts}`
- Create: `src/modules/claims/application/{publish-garments.ts,verify-original-claim.ts,claims.test.ts}`
- Create: `src/modules/claims/infrastructure/{schema.ts,drizzle-claim-repository.ts}`, `src/modules/claims/index.ts`
- Create: `drizzle/0003_claims.sql` (generated)

**Interfaces:**
- Consumes:
  - the `companies` and `articles` tables plus `createSupplierRepositories`, `createCompany`, `upsertArticle` (Task 3)
  - the `products` table plus `createProductRepository`, `createProduct` (Tasks 4–5)
- Produces, exported from `@/modules/claims`:
  - `type ClaimKind = 'original' | 'equivalent'` and `type ClaimStatus = 'declared' | 'verified'`
  - `type Claim = Readonly<{ id: string; productId: string; companyId: string; articleId: string | null; kind: ClaimKind; status: ClaimStatus; note: string | null; createdAt: Date; updatedAt: Date }>`
  - `declareClaim(input: { productId: string; companyId: string; articleId: string | null; kind: ClaimKind; note?: string | null }, now?: Date): Claim`
  - `redeclareClaim(claim: Claim, input: { articleId: string | null; kind: ClaimKind; note?: string | null }, now?: Date): Claim`
  - `verifyClaim(claim: Claim, now?: Date): Claim`
  - `rankClaims<T extends Pick<Claim, 'kind' | 'status' | 'createdAt'>>(claims: readonly T[]): T[]`
  - `interface ClaimRepository { save(c: Claim): Promise<void>; findById(id: string): Promise<Claim | null>; findByProductAndCompany(productId: string, companyId: string): Promise<Claim | null>; findVerifiedOriginal(productId: string): Promise<Claim | null> }`
  - `type GarmentItem = { productId: string; articleCode: string | null; kind: ClaimKind; note?: string | null }`
  - `publishGarments(deps: { claims: ClaimRepository; getProduct: (id: string) => Promise<{ id: string } | null>; upsertArticle: (input: { companyId: string; code: string }) => Promise<{ id: string }> }, input: { companyId: string; items: readonly GarmentItem[] }): Promise<Claim[]>`
  - `verifyOriginalClaim(deps: { claims: ClaimRepository }, claimId: string): Promise<Claim>`
  - `createClaimRepository(db: Db): ClaimRepository`
  - Table `claims`

- [ ] **Step 1: Write the failing domain tests**

```ts
// claim.test.ts
const base = { productId: 'p', companyId: 'c', articleId: 'a', kind: 'original' as const };
it('normalizes notes', () => {
  expect(declareClaim({ ...base, note: '   ' }).note).toBeNull();
  expect(() => declareClaim({ ...base, note: 'x'.repeat(281) })).toThrow(expect.objectContaining({ code: 'claim.note_too_long' }));
});
it('verifies only originals', () => {
  expect(verifyClaim(declareClaim(base)).status).toBe('verified');
  expect(() => verifyClaim(declareClaim({ ...base, kind: 'equivalent' }))).toThrow(expect.objectContaining({ code: 'claim.only_original_verifiable' }));
});
it('drops verification when kind or article changes, keeps it for note edits', () => {
  const v = verifyClaim(declareClaim(base));
  expect(redeclareClaim(v, { articleId: 'a', kind: 'equivalent' }).status).toBe('declared');
  expect(redeclareClaim(v, { articleId: 'b', kind: 'original' }).status).toBe('declared');
  expect(redeclareClaim(v, { articleId: 'a', kind: 'original', note: 'new' }).status).toBe('verified');
});

// rank-claims.test.ts
it('orders verified original, declared originals, equivalents — oldest first within a group', () => {
  const t = (n: number) => new Date(2026, 0, n);
  const c = (id: string, kind: ClaimKind, status: ClaimStatus, day: number) => ({ id, kind, status, createdAt: t(day) });
  const ranked = rankClaims([c('e1', 'equivalent', 'declared', 1), c('o3', 'original', 'declared', 3), c('v5', 'original', 'verified', 5), c('o2', 'original', 'declared', 2), c('e0', 'equivalent', 'declared', 0)]);
  expect(ranked.map(x => x.id)).toEqual(['v5', 'o2', 'o3', 'e0', 'e1']);
});
```

- [ ] **Step 2: Run them and check they fail.** Then implement `claim.ts`, `rank-claims.ts` and `repositories.ts`, and run again.

Run: `pnpm test src/modules/claims/domain`. Expected: FAIL, then PASS.

- [ ] **Step 3: Write `schema.ts` and generate the migration**

`claims`:
- `id uuid pk`
- `product_id uuid → products.id on delete cascade`
- `company_id uuid → companies.id on delete cascade`
- `article_id uuid → articles.id on delete set null`
- `kind text`, `status text default 'declared'`, `note text`, `created_at timestamptz`, `updated_at timestamptz`
- unique index `(product_id, company_id)`
- `uniqueIndex('claims_one_verified_original').on(t.productId).where(sql\`kind = 'original' and status = 'verified'\`)`

Run: `pnpm db:generate --name=claims`.

- [ ] **Step 4: Write the failing application tests** (`application/claims.test.ts`)

The helper `setup()` creates a test DB, two companies (Indigo Mill, Denizli Indigo) and two products through the supplier and catalog repositories, and returns `{ deps, ids }`. `deps.getProduct` and `deps.upsertArticle` are bound to the real repositories.

```ts
it('publishes a batch, re-publishing updates the same claim', async () => {
  const { deps, ids } = await setup();
  const [c1, c2] = await publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: '60219/1', kind: 'original' }, { productId: ids.liujo, articleCode: ' ', kind: 'equivalent' }] });
  expect(c1).toMatchObject({ kind: 'original', status: 'declared' }); expect(c1.articleId).not.toBeNull(); expect(c2.articleId).toBeNull();
  const [again] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: '60219/1', kind: 'equivalent' }] });
  expect(again.id).toBe(c1.id); expect(again.kind).toBe('equivalent');
});
it('dedupes the same product within one batch (last wins)', async () => {
  const { deps, ids } = await setup();
  const claims = await publishGarments(deps, { companyId: ids.indigo, items: [
    { productId: ids.guess, articleCode: null, kind: 'original' }, { productId: ids.guess, articleCode: null, kind: 'equivalent' }] });
  expect(claims).toHaveLength(1); expect(claims[0].kind).toBe('equivalent');
});
it('rejects empty or >50 item batches and unknown products', async () => {
  const { deps, ids } = await setup();
  await expect(publishGarments(deps, { companyId: ids.indigo, items: [] })).rejects.toMatchObject({ code: 'claims.batch_size_invalid' });
  await expect(publishGarments(deps, { companyId: ids.indigo, items: Array.from({ length: 51 }, () => ({ productId: ids.guess, articleCode: null, kind: 'original' as const })) }))
    .rejects.toMatchObject({ code: 'claims.batch_size_invalid' });
  await expect(publishGarments(deps, { companyId: ids.indigo, items: [{ productId: crypto.randomUUID(), articleCode: null, kind: 'original' }] }))
    .rejects.toMatchObject({ code: 'product.not_found' });
});
it('allows one verified original per product', async () => {
  const { deps, ids } = await setup();
  const [a] = await publishGarments(deps, { companyId: ids.indigo, items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  const [b] = await publishGarments(deps, { companyId: ids.denizli, items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  expect((await verifyOriginalClaim(deps, a.id)).status).toBe('verified');
  await expect(verifyOriginalClaim(deps, b.id)).rejects.toMatchObject({ code: 'claim.already_verified_original' });
  await expect(deps.claims.save(verifyClaim(b))).rejects.toThrow(); // DB partial unique index
});
```

- [ ] **Step 5: Implement the repository, `publishGarments`, `verifyOriginalClaim` and `index.ts`**

Run: `pnpm test src/modules/claims`. Expected: PASS.

- `publishGarments` dedupes with a `Map` keyed by `productId` (last item wins), then processes items in order.
- A blank or whitespace `articleCode` gives `articleId = null`.
- `verifyOriginalClaim`: a missing claim throws `claim.not_found`. If `findVerifiedOriginal` returns another claim, throw `claim.already_verified_original`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(claims): declare, rank and verify garment claims"
```

---

### Task 7: Identity context (profiles, onboarding, Better Auth)

**Files:**
- Create: `src/modules/identity/domain/{profile.ts,profile.test.ts,repositories.ts}`
- Create: `src/modules/identity/application/{complete-onboarding.ts,identity.test.ts}`
- Create: `src/modules/identity/infrastructure/{auth-schema.ts,schema.ts,auth.ts,auth.test.ts,drizzle-profile-repository.ts,user-directory.ts}`, `src/modules/identity/index.ts`
- Create: `drizzle/0004_identity.sql` (generated)

**Interfaces:**
- Consumes: `slugify`, `DomainError`, `Db`, `Mailer`, `createRecordingMailer` (Task 2), `registerCompany` and `createSupplierRepositories` (Task 3, in tests and in the container)
- Produces, exported from `@/modules/identity`:
  - `type Role = 'mill' | 'agent'`
  - `type Profile = Readonly<{ userId: string; role: Role; displayName: string; handle: string | null; createdAt: Date }>`
  - `createProfile(input: { userId: string; role: Role; displayName: string }, randomSuffix: () => string, now?: Date): Profile`
  - `interface ProfileRepository { save(p: Profile): Promise<void>; findByUserId(id: string): Promise<Profile | null>; findByHandle(handle: string): Promise<Profile | null>; handleExists(handle: string): Promise<boolean> }`
  - `completeOnboarding(deps: { profiles: ProfileRepository; registerCompany: (input: { name: string; city: string; country: string; ownerUserId: string }) => Promise<{ slug: string }>; randomSuffix?: () => string }, input: { userId: string; displayName: string; role: Role; company?: { name: string; city: string; country: string } }): Promise<{ profile: Profile; companySlug: string | null }>`
  - `createAuth(deps: { db: Db; mailer: Mailer; baseUrl: string; secret: string }): Auth` and `type Auth = ReturnType<typeof createAuth>`
  - `createProfileRepository(db: Db): ProfileRepository`
  - `createUserDirectory(db: Db): { getEmail(userId: string): Promise<string | null> }`
  - Tables `user`, `session`, `account`, `verification` (`auth-schema.ts`) and `profiles` (`schema.ts`)

- [ ] **Step 1: Write the failing profile test, then implement**

```ts
it('gives agents a readable handle and mills none', () => {
  expect(createProfile({ userId: 'u1', role: 'agent', displayName: 'Laura Martin' }, () => 'x7k2').handle).toBe('lauramartin-x7k2');
  expect(createProfile({ userId: 'u2', role: 'mill', displayName: 'Ali Kaya' }, () => 'zzzz').handle).toBeNull();
  expect(() => createProfile({ userId: 'u3', role: 'agent', displayName: 'L' }, () => 'a')).toThrow(expect.objectContaining({ code: 'profile.name_invalid' }));
});
```

- Display name: 2–60 characters after trimming.
- Agent handle: `` `${slugify(displayName).replaceAll('-', '').slice(0, 16)}-${randomSuffix()}` ``.

Run: `pnpm test src/modules/identity/domain`. Expected: FAIL, then PASS.

- [ ] **Step 2: Write the Better Auth tables and `profiles`, then generate the migration**

**`auth-schema.ts`:** generate it with the Better Auth CLI against a throwaway config file that exports `auth = createAuth(...)`:

```bash
pnpm dlx @better-auth/cli@latest generate --config scripts/auth-cli.ts --output src/modules/identity/infrastructure/auth-schema.ts
```

If the CLI can't load the config, write the four core tables (`user`, `session`, `account`, `verification`) by hand from the Better Auth "Core Schema" docs.

**`profiles`:** `user_id text pk → user.id on delete cascade`, `role text`, `display_name text`, `handle text unique`, `created_at timestamptz`.

Delete `scripts/auth-cli.ts` afterwards, then run `pnpm db:generate --name=identity`.

- [ ] **Step 3: Write the failing onboarding and auth tests**

```ts
// identity.test.ts
it('onboards a mill with its company, once', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db); const supplier = createSupplierRepositories(db);
  const deps = { profiles, registerCompany: (i: Parameters<typeof registerCompany>[1]) => registerCompany(supplier, i) };
  const r = await completeOnboarding(deps, { userId: 'u1', displayName: 'Ali Kaya', role: 'mill', company: { name: 'Aksu Denim', city: 'Istanbul', country: 'TR' } });
  expect(r).toMatchObject({ companySlug: 'aksu-denim', profile: { role: 'mill', handle: null } });
  await expect(completeOnboarding(deps, { userId: 'u1', displayName: 'Ali', role: 'agent' })).rejects.toMatchObject({ code: 'profile.exists' });
  await expect(completeOnboarding(deps, { userId: 'u9', displayName: 'No Co', role: 'mill' })).rejects.toMatchObject({ code: 'profile.company_required' });
});
it('retries colliding agent handles', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db);
  await profiles.save(createProfile({ userId: 'u0', role: 'agent', displayName: 'Laura Martin' }, () => 'aaaa'));
  const seq = ['aaaa', 'aaaa', 'bbbb']; const r = await completeOnboarding({ profiles, registerCompany: async () => ({ slug: '' }), randomSuffix: () => seq.shift()! },
    { userId: 'u1', displayName: 'Laura Martin', role: 'agent' });
  expect(r.profile.handle).toBe('lauramartin-bbbb');
});

// auth.test.ts
it('emails a magic link', async () => {
  const mailer = createRecordingMailer();
  const auth = createAuth({ db: await createTestDb(), mailer, baseUrl: 'http://localhost:3000', secret: 'test-secret-test-secret-test-secret' });
  await auth.api.signInMagicLink({ body: { email: 'mill@example.test', callbackURL: '/onboarding' }, headers: new Headers() });
  expect(mailer.sent[0]).toMatchObject({ to: 'mill@example.test', subject: 'Your xmanufacture sign-in link' });
  expect(mailer.sent[0].text).toMatch(/http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?token=/);
});
```

- [ ] **Step 4: Implement `completeOnboarding`, the repository, `user-directory.ts`, `auth.ts` and `index.ts`**

**`completeOnboarding`:**
- Throws `profile.exists` if the user already has a profile, and `profile.company_required` for a mill with no company.
- Calls `registerCompany` **before** saving the profile.
- Tries up to 5 suffixes while `handleExists`, then throws `profile.handle_unavailable`.
- The default `randomSuffix` is 4 characters from `[a-z0-9]`, using `crypto.getRandomValues`.

**`createAuth`** returns `betterAuth({...})` with:
- `baseURL`, `secret`
- `database: drizzleAdapter(db, { provider: 'pg', schema: authSchema })`
- `emailAndPassword: { enabled: false }`
- `plugins: [magicLink({ expiresIn: 600, sendMagicLink: ({ email, url }) => mailer.send({ to: email, subject: 'Your xmanufacture sign-in link', text: `Sign in to xmanufacture:\n\n${url}\n\nThis link expires in 10 minutes.` }) }), nextCookies()]`

Run: `pnpm test src/modules/identity`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(identity): profiles, onboarding, magic-link auth"
```

---

### Task 8: Inquiry context

**Files:**
- Create: `src/modules/inquiry/domain/{inquiry.ts,inquiry.test.ts,repositories.ts}`
- Create: `src/modules/inquiry/application/{submit-inquiry.ts,manage-inquiries.ts,inquiry.test.ts}`
- Create: `src/modules/inquiry/infrastructure/{schema.ts,drizzle-inquiry-repository.ts}`, `src/modules/inquiry/index.ts`
- Create: `drizzle/0005_inquiry.sql` (generated)

**Interfaces:**
- Consumes: `Mailer`, `createRecordingMailer`, `Db` (Task 2), plus the `companies`, `products` and `articles` tables (for foreign keys)
- Produces, exported from `@/modules/inquiry`:
  - `type InquiryKind = 'swatch' | 'quote'`
  - `type Inquiry = Readonly<{ id: string; companyId: string; productId: string | null; articleId: string | null; kind: InquiryKind; buyerName: string; buyerEmail: string; buyerCompany: string | null; quantityMeters: number | null; message: string | null; viaAgentHandle: string | null; status: 'new' | 'answered'; createdAt: Date }>`
  - `type InquiryInput = { companyId: string; productId: string | null; articleId: string | null; kind: InquiryKind; buyerName: string; buyerEmail: string; buyerCompany?: string | null; quantityMeters?: number | null; message?: string | null }`
  - `createInquiry(input: InquiryInput & { viaAgentHandle: string | null }, now?: Date): Inquiry` and `markAnswered(i: Inquiry): Inquiry`
  - `interface InquiryRepository { save(i: Inquiry): Promise<void>; findById(id: string): Promise<Inquiry | null>; countRecentFrom(companyId: string, buyerEmail: string, since: Date): Promise<number>; countNew(companyId: string): Promise<number> }`
  - `submitInquiry(deps: { inquiries: InquiryRepository; mailer: Mailer; agentHandleExists: (h: string) => Promise<boolean>; companyOwnerEmail: (companyId: string) => Promise<string | null>; baseUrl: string; now?: () => Date }, input: InquiryInput & { viaAgentHandle?: string | null }): Promise<Inquiry>`
  - `markInquiryAnswered(deps: { inquiries: InquiryRepository }, input: { companyId: string; inquiryId: string }): Promise<Inquiry>`
  - `countNewInquiries(deps: { inquiries: InquiryRepository }, companyId: string): Promise<number>`
  - `createInquiryRepository(db: Db): InquiryRepository`
  - Table `inquiries`

- [ ] **Step 1: Write the failing domain tests, then implement**

```ts
const ok = { companyId: 'c', productId: 'p', articleId: null, kind: 'swatch' as const, buyerName: 'Ana Buyer', buyerEmail: ' Ana@Brand.TEST ', viaAgentHandle: null };
it('normalizes email and defaults optional fields', () =>
  expect(createInquiry(ok)).toMatchObject({ buyerEmail: 'ana@brand.test', buyerCompany: null, quantityMeters: null, status: 'new' }));
it.each([
  [{ buyerEmail: 'not-an-email' }, 'inquiry.email_invalid'], [{ buyerName: '' }, 'inquiry.name_invalid'],
  [{ productId: null }, 'inquiry.target_required'], [{ quantityMeters: 0 }, 'inquiry.quantity_invalid'],
  [{ message: 'x'.repeat(2001) }, 'inquiry.message_too_long'],
])('rejects %j', (patch, code) => expect(() => createInquiry({ ...ok, ...patch })).toThrow(expect.objectContaining({ code })));
```

Rules:
- Name 1–100 characters.
- Email trimmed and lowercased, matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Buyer company up to 120 characters.
- Quantity an integer from 1 to 1,000,000.
- Message up to 2000 characters.
- At least one of `productId` or `articleId`.

Run: `pnpm test src/modules/inquiry/domain`. Expected: FAIL, then PASS.

- [ ] **Step 2: Write `schema.ts` and generate the migration**

`inquiries`:
- `id uuid pk`
- `company_id → companies.id cascade`
- `product_id → products.id set null`
- `article_id → articles.id set null`
- `kind`, `buyer_name`, `buyer_email`, `buyer_company`, `quantity_meters integer`, `message`, `via_agent_handle text`, `status text default 'new'`, `created_at timestamptz`
- index `(company_id, buyer_email, created_at)`

Run: `pnpm db:generate --name=inquiry`.

- [ ] **Step 3: Write the failing application tests**

`setup({ agents, ownerEmail, now? })` seeds two companies (`indigo`, `denizli`) and one product (`guess`) as in Task 6, plus an agent-profile lookup over `agents`. It returns `{ deps, ids, mailer }`, where `mailer` is a recording mailer and `baseUrl` is `'http://localhost:3000'`.

```ts
it('saves, credits a real agent and emails the mill owner', async () => {
  const { deps, ids, mailer } = await setup({ agents: ['lauramartin-x7k2'], ownerEmail: 'mill@example.test' });
  const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'swatch', buyerName: 'Ana Buyer', buyerEmail: 'ana@brand.test', buyerCompany: 'Brand Co', quantityMeters: 1000, viaAgentHandle: 'lauramartin-x7k2' });
  expect(inq.viaAgentHandle).toBe('lauramartin-x7k2');
  expect(mailer.sent[0]).toMatchObject({ to: 'mill@example.test', subject: 'New swatch request from Brand Co' });
  expect(mailer.sent[0].text).toContain('Via agent: @lauramartin-x7k2');
  expect(mailer.sent[0].text).toContain('http://localhost:3000/requests');
});
it('drops unknown or malformed agent handles', async () => {
  const { deps, ids, mailer } = await setup({ agents: [], ownerEmail: 'mill@example.test' });
  for (const via of ['ghost-0000', '<script>alert(1)</script>']) {
    const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: `b${via.length}@x.test`, viaAgentHandle: via });
    expect(inq.viaAgentHandle).toBeNull();
  }
  expect(mailer.sent.every(m => !m.text.includes('Via agent'))).toBe(true);
});
it('rate-limits 5 per buyer email per company per 24h', async () => {
  let now = new Date('2026-10-25T10:00:00Z'); const { deps, ids } = await setup({ agents: [], ownerEmail: null, now: () => now });
  const send = () => submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'spam@x.test' });
  for (let i = 0; i < 5; i++) await send();
  await expect(send()).rejects.toMatchObject({ code: 'inquiry.rate_limited' });
  now = new Date('2026-10-26T11:00:00Z'); await expect(send()).resolves.toBeTruthy();
});
it('only the owning company marks answered', async () => {
  const { deps, ids } = await setup({ agents: [], ownerEmail: null });
  const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'b@x.test' });
  await expect(markInquiryAnswered(deps, { companyId: ids.denizli, inquiryId: inq.id })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect((await markInquiryAnswered(deps, { companyId: ids.indigo, inquiryId: inq.id })).status).toBe('answered');
  expect(await countNewInquiries(deps, ids.indigo)).toBe(0);
});
```

- [ ] **Step 4: Implement the use cases, the repository and `index.ts`**

**Agent handle:** kept only if it matches `/^[a-z0-9-]{3,40}$/` **and** `agentHandleExists(handle)`; otherwise it's `null`.

**Email to the owner** (skipped when the owner email is `null`):
- subject: `New ${kind} request from ${buyerCompany ?? buyerName}`
- body, in this order: buyer name, email and company; quantity as `${n} m` when given; the message; `Via agent: @handle` when set; `Open your requests: ${baseUrl}/requests`

Run: `pnpm test src/modules/inquiry`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(inquiry): swatch and quote requests with agent credit"
```

---

### Task 9: Discovery read models and demo seed

**Files:**
- Create: `src/modules/discovery/infrastructure/{types.ts,product-page-view.ts,article-page-view.ts,company-page-view.ts,recently-tagged.ts,declared-originals.ts,company-inquiries.ts,discovery.test.ts}`, `src/modules/discovery/index.ts`
- Create: `src/server/demo-ids.ts`, `src/server/seed-demo.ts`, `scripts/seed.ts`

**Interfaces:**
- Consumes: every table schema (Tasks 3–8), `rankClaims` / `ClaimKind` / `ClaimStatus` from `@/modules/claims`, `ArticleSpecs` from `@/modules/supplier`, and the module factories (for the seed)
- Produces, exported from `@/modules/discovery`:
  - `type CompanyRef = { id: string; slug: string; name: string; city: string; country: string }`
  - `type ClaimView = { claimId: string; kind: ClaimKind; status: ClaimStatus; note: string | null; createdAt: Date; company: CompanyRef; article: { id: string; slug: string; code: string; specs: ArticleSpecs } | null }`
  - `type ProductPageView = { product: { id: string; brand: string; name: string; imageUrl: string | null; composition: string | null; sourceUrl: string }; originals: ClaimView[]; equivalents: ClaimView[] }`
  - `type GarmentTile = { productId: string; brand: string; name: string; imageUrl: string | null; kind: ClaimKind | null; originals: number; equivalents: number }`
  - `type ArticlePageView = { company: CompanyRef & { ownerUserId: string }; article: { id: string; slug: string; code: string; specs: ArticleSpecs }; garments: GarmentTile[] }`
  - `type CompanyPageView = { company: CompanyRef & { ownerUserId: string }; articles: { slug: string; code: string; garmentCount: number }[]; garments: GarmentTile[] }`
  - `type DeclaredOriginal = { claimId: string; createdAt: Date; product: { id: string; brand: string; name: string }; company: { slug: string; name: string } }`
  - `type InquiryRow = { id: string; kind: 'swatch' | 'quote'; status: 'new' | 'answered'; buyerName: string; buyerEmail: string; buyerCompany: string | null; quantityMeters: number | null; message: string | null; viaAgentHandle: string | null; createdAt: Date; target: { href: string; label: string } }`
  - `getProductPageView(db: Db, productId: string): Promise<ProductPageView | null>`
  - `getArticlePageView(db: Db, companySlug: string, articleSlug: string): Promise<ArticlePageView | null>`
  - `getCompanyPageView(db: Db, companySlug: string): Promise<CompanyPageView | null>`
  - `listRecentlyTagged(db: Db, limit?: number): Promise<GarmentTile[]>` (default 12)
  - `listDeclaredOriginals(db: Db): Promise<DeclaredOriginal[]>`
  - `listCompanyInquiries(db: Db, companyId: string): Promise<InquiryRow[]>`
- Produces, from `src/server`:
  - `DEMO` (fixed UUIDs, slugs, emails and the handle `lauramartin-demo`) in `demo-ids.ts`, which has no imports
  - `seedDemo(db: Db): Promise<void>`

- [ ] **Step 1: Write `demo-ids.ts` and `seedDemo`** (this is the shared fixture for these tests, `pnpm seed` and every e2e spec)

**Seeded users** (Better Auth `user` rows with `emailVerified: true`, plus their profiles):

| Email | Profile |
|---|---|
| `mill@example.test` | owner of **Indigo Mill**, Istanbul TR |
| `denizli@example.test` | owner of **Denizli Indigo**, Denizli TR |
| `bursa@example.test` | owner of **Bursa Weave**, Bursa TR |
| `agent@example.test` | agent **Laura Martin**, handle `lauramartin-demo` |

**Indigo Mill's articles:**
- `60219/1`: 12.5 oz, `98% CO 2% EA`, `Rigid · dark indigo`, MOQ 1000, 3 weeks
- `60409/1`: no specs

**Seeded products** (`imageUrl: null`):
- GUESS "Cropped Denim Blazer" at `https://guess.eu/en/cropped-denim-blazer-W5RN12`
- LIU-JO "Printed Denim Jacket" at `https://liujo.com/it/printed-denim-jacket-UF4012`
- EMPORIO ARMANI "Trucker Jacket" at `https://armani.com/en/trucker-jacket-6R1B79`

**Seeded claims,** with `createdAt` increasing in this order:

| Product | Company | Article | Kind | Status |
|---|---|---|---|---|
| Guess | Indigo Mill | 60219/1 | original | verified |
| Guess | Denizli Indigo | — | equivalent | declared, note "Same twill, 13 oz, rigid. Swatch in stock." |
| Guess | Bursa Weave | — | equivalent | declared |
| Liu-Jo | Indigo Mill | 60409/1 | original | declared |
| Armani | Denizli Indigo | — | equivalent | declared |

**Seeded inquiry:** one to Indigo Mill about Guess. Buyer "Seed Buyer", `seed@buyer.test`, company "Seed Buyer Co", swatch, 500 m, via `lauramartin-demo`.

`seedDemo` is idempotent: it does nothing if `DEMO.companies.indigo` already exists.

- [ ] **Step 2: Write the failing discovery tests** (each test runs `createTestDb()` then `seedDemo`)

```ts
it('builds the garment page with ranked originals and equivalents', async () => {
  const v = await getProductPageView(db, DEMO.products.guess);
  expect(v?.originals.map(c => [c.company.name, c.status, c.article?.code, c.article?.specs.moqMeters])).toEqual([['Indigo Mill', 'verified', '60219/1', 1000]]);
  expect(v?.equivalents.map(c => c.company.name)).toEqual(['Denizli Indigo', 'Bursa Weave']);
  expect(await getProductPageView(db, crypto.randomUUID())).toBeNull();
});
it('article page shows only that mill’s garments', async () => {
  const v = await getArticlePageView(db, 'indigo-mill', '60219-1');
  expect(v?.garments.map(g => g.brand)).toEqual(['GUESS']);
  expect(v?.article.specs.weightOz).toBe(12.5);
});
it('mill page lists articles with garment counts', async () => {
  const v = await getCompanyPageView(db, 'indigo-mill');
  expect(v?.articles).toEqual([{ slug: '60219-1', code: '60219/1', garmentCount: 1 }, { slug: '60409-1', code: '60409/1', garmentCount: 1 }]);
  expect(v?.garments.map(g => [g.brand, g.kind])).toEqual([['LIU-JO', 'original'], ['GUESS', 'original']]);
});
it('recently tagged is ordered by latest claim with counts', async () => {
  const tiles = await listRecentlyTagged(db);
  expect(tiles.map(t => [t.brand, t.originals, t.equivalents])).toEqual([['EMPORIO ARMANI', 0, 1], ['LIU-JO', 1, 0], ['GUESS', 1, 2]]);
});
it('lists declared (unverified) originals for admin', async () =>
  expect((await listDeclaredOriginals(db)).map(d => d.product.brand)).toEqual(['LIU-JO']));
it('lists a mill’s inquiries with a readable target', async () => {
  const rows = await listCompanyInquiries(db, DEMO.companies.indigo);
  expect(rows[0]).toMatchObject({ buyerCompany: 'Seed Buyer Co', viaAgentHandle: 'lauramartin-demo', target: { href: `/p/${DEMO.products.guess}`, label: 'GUESS — Cropped Denim Blazer' } });
});
```

- [ ] **Step 3: Run them and check they fail.** Then implement the queries and run again.

Run: `pnpm test src/modules/discovery`. Expected: FAIL, then PASS.

- Garment and mill page views call `rankClaims` and split the result by kind.
- Mill page garments are ordered by claim `createdAt` descending, and its articles by `code` ascending.
- `listCompanyInquiries` orders `new` first, then by `createdAt` descending. The target label is `BRAND — Name` for a product or `Article CODE` for an article, with `href` set to `/p/:id` or `/m/:company/a/:slug`.

- [ ] **Step 4: Create `scripts/seed.ts` and verify it**

`scripts/seed.ts`: `await seedDemo(createDb(process.env.DATABASE_URL ?? './.data/dev'))`.

Run: `pnpm db:reset && pnpm seed && pnpm seed`. Expected: both runs exit 0, because the second one is a no-op.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(discovery): page read models and demo seed"
```

---

### Task 10: Composition root, Garm UI foundation, e2e harness

**Files:**
- Create: `src/server/{config.ts,config.test.ts,container.ts,viewer.ts}`
- Create: `src/app/_lib/{action-result.ts,action-result.test.ts,error-messages.ts}`, `src/app/_actions/sign-out.ts`
- Create: `src/app/_components/chrome/{ticker.tsx,site-header.tsx,istanbul-clock.tsx,format-clock.ts,format-clock.test.ts,site-nav.tsx,site-footer.tsx}`
- Create: `src/app/_components/ui/{button.tsx,chip.tsx,badge.tsx,denim-placeholder.tsx,garment-image.tsx,garment-tile.tsx,garment-grid.tsx}`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder heading only, replaced in Task 15)
- Create: `playwright.config.ts`, `e2e/fixture-server.mjs`, `e2e/fixtures/washed-denim-jacket.html`, `e2e/helpers.ts`, `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: all module factories and use cases, plus `seedDemo` and `DEMO`
- Produces:
  - `type AppConfig = { databaseUrl: string | null; baseUrl: string; authSecret: string; adminEmails: string[]; resendApiKey: string | null; mailFrom: string; mailLogFile: string | null; allowPrivateHosts: boolean }`
  - `readConfig(env?: Record<string, string | undefined>): AppConfig`
  - `type Container = { config: AppConfig; db: Db; mailer: Mailer; auth: Auth; companies: CompanyRepository; articles: ArticleRepository; products: ProductRepository; fetcher: ProductPageFetcher; claims: ClaimRepository; inquiries: InquiryRepository; profiles: ProfileRepository; users: { getEmail(id: string): Promise<string | null> } }`
  - `getContainer(): Promise<Container>`, wrapped in React `cache()` so there's one per request
  - `type Viewer = { userId: string; email: string; isAdmin: boolean; profile: Profile | null; company: Company | null }`
  - `getViewer(): Promise<Viewer | null>`, `requireViewer(): Promise<Viewer>` (redirects to `/sign-in`), `requireMill(): Promise<Viewer & { company: Company }>` (redirects to `/onboarding`), `requireAdmin(): Promise<Viewer>` (redirects to `/`)
  - `type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string }`
  - `toActionError(e: unknown): { ok: false; error: string }` (rethrows anything that isn't a `DomainError`)
  - `formatClock(d: Date): string`
  - `signOutAction(): Promise<void>` (calls `auth.api.signOut({ headers: await headers() })`, then `redirect('/')`)
  - UI components: `Button({ variant: 'cta' | 'ghost' } & ButtonHTMLAttributes)`, `Chip`, `Badge({ tone: 'accent' | 'outline' })`, `GarmentImage({ src: string | null; alt: string; credit?: { host: string; href: string } })`, `GarmentTile({ tile: GarmentTile; href: string; tag: string; tagTone?: 'accent' | 'muted' })`, `GarmentGrid({ children })`
  - E2E helpers: `signIn(page: Page, email: string): Promise<void>` and `lastMailTo(email: string): Promise<{ subject: string; text: string }>`

- [ ] **Step 1: Write the failing unit tests**

```ts
// config.test.ts
it('parses env with safe defaults', () => {
  expect(readConfig({ DATABASE_URL: './.data/dev', BETTER_AUTH_SECRET: 's'.repeat(32), PUBLIC_BASE_URL: 'http://localhost:3000', ADMIN_EMAILS: ' A@x.test, b@x.test ' }))
    .toMatchObject({ adminEmails: ['a@x.test', 'b@x.test'], resendApiKey: null, allowPrivateHosts: false, baseUrl: 'http://localhost:3000' });
  expect(() => readConfig({ BETTER_AUTH_SECRET: 'short', PUBLIC_BASE_URL: 'http://x' })).toThrow(/BETTER_AUTH_SECRET/);
});
// action-result.test.ts
it('maps domain errors to copy and rethrows the rest', () => {
  expect(toActionError(new DomainError('company.name_invalid'))).toEqual({ ok: false, error: 'Company name must be 2–80 characters.' });
  expect(toActionError(new DomainError('unknown.code'))).toEqual({ ok: false, error: 'Something went wrong. Please try again.' });
  expect(() => toActionError(new Error('boom'))).toThrow('boom');
});
// format-clock.test.ts
it('shows Istanbul time', () => expect(formatClock(new Date('2026-10-25T09:04:05Z'))).toBe('12:04:05'));
```

- [ ] **Step 2: Run them and check they fail.** Then implement and run again.

Run: `pnpm test src/server src/app`. Expected: FAIL, then PASS.

- `readConfig` throws when `BETTER_AUTH_SECRET` is shorter than 32 characters.
- `error-messages.ts` has one English sentence per `DomainError` code used in Tasks 3–8.
- `formatClock` uses `toLocaleTimeString('en-GB', { timeZone: 'Europe/Istanbul', hour12: false })`.

- [ ] **Step 3: Implement `container.ts` and `viewer.ts`**

**`getContainer`:**
- `db = createDb(config.databaseUrl ?? './.data/dev')`. Task 17 adds the Hyperdrive branch.
- Mailer: Resend when `resendApiKey` is set, otherwise the console mailer with `mailLogFile`.
- `auth = createAuth({ db, mailer, baseUrl, secret })`, plus every repository factory.

**`getViewer`:** `auth.api.getSession({ headers: await headers() })`, then load the profile, the company (`findByOwner`), and `isAdmin` (the email, lowercased, is in `adminEmails`).

- [ ] **Step 4: Apply the Garm design tokens and build the chrome**

**`globals.css`** (Tailwind v4):
- `@theme`: `--color-ink: #000000; --color-paper: #ffffff; --color-accent: #F0721F; --color-muted: #707070; --font-sans: var(--font-space-grotesk), sans-serif;`
- `body` is `bg-paper text-ink uppercase text-[13px]`.
- Define the ticker keyframes here.

**`layout.tsx`:**
- Space Grotesk via `next/font/google` with weights `['400','500','600','700']` and `variable: '--font-space-grotesk'`.
- Renders `Ticker`, `SiteHeader` (the "XMANUFACTURE" wordmark, plus `IstanbulClock` as a client component that ticks every second), `SiteNav`, `{children}` and `SiteFooter`.

**`SiteNav`** shows:
- SEARCH (`/`) · MILLS
- on the right, ADD GARMENT and REQUESTS when the viewer has a company. The count of new requests sits in `<span data-testid="new-requests-count">`, rendered only when it's above 0.
- ADMIN when `isAdmin`
- SIGN IN / SIGN OUT

**Tiles:** the `GarmentTile` root element carries `data-testid="garment-tile"`.

**Image components:** `GarmentImage` renders `<img referrerPolicy="no-referrer" loading="lazy">`, and falls back to `DenimPlaceholder` (the CSS twill from the mockup) when `src` is `null` or on error. It's a client component, and its file carries an eslint-disable for `@next/next/no-img-element`, with a comment explaining that brand hosts are arbitrary.

Copy the measurements from `docs/design/mockup-pages-v1.html`.

- [ ] **Step 5: Build the e2e harness**

**Fixtures:**
- `e2e/fixture-server.mjs`: `node:http` on port 4010. It serves `e2e/fixtures/*.html` and answers `403` for `/blocked.html`.
- `e2e/fixtures/washed-denim-jacket.html`: JSON-LD Product with `name` "Washed Denim Jacket", `brand` "GUESS", `material` "100% Cotton".

**`playwright.config.ts`:**
- `workers: 1`, `fullyParallel: false`, `use.baseURL: 'http://localhost:3100'`
- `webServer: [{ command: 'node e2e/fixture-server.mjs', port: 4010 }, { command: 'rm -rf .data/e2e .outbox && pnpm drizzle-kit migrate && pnpm seed && pnpm next dev -p 3100', port: 3100, timeout: 120_000, env: {...} }]`
- The `env` sets `DATABASE_URL=./.data/e2e`, `BETTER_AUTH_URL` and `PUBLIC_BASE_URL` to `http://localhost:3100`, `BETTER_AUTH_SECRET=e2e-secret-e2e-secret-e2e-secret-e2e`, `ADMIN_EMAILS=admin@example.test`, `MAIL_LOG_FILE=.outbox/e2e-mail.log` and `FETCH_ALLOW_PRIVATE_HOSTS=1`.

**`e2e/helpers.ts`:**
- `signIn`: goes to `/sign-in`, fills the email, submits, polls `.outbox/e2e-mail.log` for up to 5 s for the newest entry to that address, then `page.goto` the first `http…` URL in its text.
- `lastMailTo`: returns the newest entry for that address.

- [ ] **Step 6: Write the smoke spec and run it**

```ts
test('chrome renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('xmanufacture', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/ISTANBUL, TR/i)).toBeVisible();
});
```

Run: `pnpm build && pnpm e2e e2e/smoke.spec.ts`. Expected: the build succeeds and 1 test passes.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(app): composition root, Garm design system, e2e harness"
```

---

### Task 11: Sign-in and onboarding

**Files:**
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/app/sign-in/{page.tsx,sign-in-form.tsx,actions.ts}`
- Create: `src/app/onboarding/{page.tsx,onboarding-form.tsx,actions.ts}`
- Create: `e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `getContainer`, `getViewer`, `ActionResult`, `toActionError` (Task 10), and `completeOnboarding` / `registerCompany` (Tasks 3, 7)
- Produces:
  - the route handler (`GET`/`POST` delegate to `toNextJsHandler((await getContainer()).auth)`)
  - `sendSignInLinkAction(prev: ActionResult | null, form: FormData): Promise<ActionResult>`
  - `completeOnboardingAction(prev: ActionResult | null, form: FormData): Promise<ActionResult>` (redirects mills to `/add` and agents to `/`)

- [ ] **Step 1: Write the failing e2e spec** (`e2e/onboarding.spec.ts`)

```ts
test('a new mill signs in, registers its company and lands on Add', async ({ page }) => {
  await signIn(page, 'new-mill@example.test');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: /i'm at a mill/i }).check();
  await page.getByLabel(/your name/i).fill('Ali Kaya');
  await page.getByLabel(/company name/i).fill('Aksu Denim');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/add$/);
});
test('a new agent signs in and gets a handle', async ({ page }) => {
  await signIn(page, 'new-agent@example.test');
  await page.getByRole('radio', { name: /i'm an agent/i }).check();
  await page.getByLabel(/your name/i).fill('Laura Test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL('http://localhost:3100/');
});
test('onboarding errors are shown inline', async ({ page }) => {
  await signIn(page, 'bad-mill@example.test');
  await page.getByRole('radio', { name: /i'm at a mill/i }).check();
  await page.getByLabel(/your name/i).fill('Ali');
  await page.getByLabel(/company name/i).fill('A');
  await page.getByLabel(/city/i).fill('Istanbul'); await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Company name must be 2–80 characters.')).toBeVisible();
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm e2e e2e/onboarding.spec.ts`. Expected: FAIL (the routes don't exist).

- [ ] **Step 3: Implement the route handler, sign-in and onboarding**

**Sign-in:** the server action calls `auth.api.signInMagicLink({ body: { email, callbackURL: '/onboarding' }, headers: await headers() })` and returns `{ ok: true }`. The form then shows "CHECK YOUR EMAIL".

**Onboarding:**
- The page redirects away if a profile already exists (mill → `/add`, agent → `/`).
- `requireViewer()` runs first.
- Zod parses `role`, `displayName`, `companyName`, `city` and `country`.
- `userId` comes from the viewer.

**Forms:** use `useActionState`. Layout follows the Garm look: thin lines, uppercase labels, and an orange CONTINUE button.

- [ ] **Step 4: Run it and check it passes**

Run: `pnpm e2e e2e/onboarding.spec.ts`. Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): magic-link sign-in and onboarding"
```

---

### Task 12: Garment page with requests and link previews

**Files:**
- Create: `src/app/p/[id]/page.tsx`, `src/app/_components/inquiry-form.tsx`, `src/app/_actions/submit-inquiry.ts`
- Create: `e2e/garment-page.spec.ts`

**Interfaces:**
- Consumes: `getProductPageView` (Task 9), `submitInquiry` (Task 8), `getContainer` / `ActionResult` / `toActionError` and the UI components (Task 10), `DEMO`
- Produces:
  - `InquiryForm({ companyId: string; companyName: string; productId?: string; articleId?: string; kind: 'swatch' | 'quote'; via: string | null; label: string })` (client component)
  - `submitInquiryAction(prev: ActionResult | null, form: FormData): Promise<ActionResult>`
  - `resolveAgent(via: string | undefined): Promise<{ handle: string; displayName: string } | null>` (exported from the page module's sibling `src/app/_lib/resolve-agent.ts`)

- [ ] **Step 1: Write the failing e2e spec**

```ts
const url = `/p/${DEMO.products.guess}`;
test('buyer arrives via an agent link and requests a swatch', async ({ page }) => {
  await page.goto(`${url}?via=lauramartin-demo`);
  await expect(page.getByText(/shared by agent/i)).toContainText('Laura Martin');
  const original = page.getByTestId('original-claim');
  await expect(original).toContainText('Indigo Mill'); await expect(original).toContainText('Verified'); await expect(original).toContainText('60219/1');
  await expect(page.getByTestId('equivalent-claim').first()).toContainText('Denizli Indigo');
  await original.getByRole('button', { name: /request swatch/i }).click();
  await page.getByLabel(/your name/i).fill('Ana Buyer'); await page.getByLabel(/email/i).fill('ana@brand.test');
  await page.getByLabel(/company/i).fill('Brand Co'); await page.getByLabel(/quantity/i).fill('1000');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.getByText(/request sent/i)).toBeVisible();
  expect((await lastMailTo('mill@example.test')).text).toContain('Via agent: @lauramartin-demo');
});
test('a tampered via is ignored and never rendered raw', async ({ page }) => {
  await page.goto(`${url}?via=%3Cscript%3Ealert(1)%3C%2Fscript%3E`);
  await expect(page.getByText(/shared by agent/i)).toHaveCount(0);
});
test('link previews carry title and description', async ({ request }) => {
  const html = await (await request.get(url)).text();
  expect(html).toContain('<meta property="og:title" content="GUESS — Cropped Denim Blazer"');
  expect(html).toMatch(/<meta property="og:description" content="Fabric by Indigo Mill \(article 60219\/1\) · 2 mills can make an equivalent"/);
});
test('unknown product is a 404', async ({ page }) => {
  expect((await page.goto('/p/not-a-uuid'))?.status()).toBe(404);
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm e2e e2e/garment-page.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the page, the inquiry form and the action**

**Page:**
- `params` and `searchParams` are awaited.
- A non-UUID id or a missing view calls `notFound()`.

**`generateMetadata`:**
- title `` `${brand} — ${name}` ``
- description: `` `Fabric by ${company} (article ${code}) · ${n} mills can make an equivalent` `` when there's an original (leave out the parenthesis if there's no article), otherwise `` `${n} mills can make an equivalent` ``
- `openGraph: { title, description, url: `${baseUrl}/p/${id}`, images: imageUrl ? [imageUrl] : [] }`

**Layout** (per the mockup's PRODUCT tab, stacking below 760px):
- **Left:** `GarmentImage` with the credit `PHOTO: <host> ↗` linking to `sourceUrl`.
- **Right panel**, top to bottom:
  1. ← BACK
  2. the agent banner, when `resolveAgent(via)` returns an agent
  3. brand · name · composition · "VIEW ON <HOST> ↗"
  4. `data-testid="original-claim"` blocks: company name, VERIFIED (accent) or DECLARED (outline) badge, article chips (code, weight, composition, MOQ, lead time), and an `InquiryForm` with kind `swatch`
  5. the "Can make an equivalent (n)" list of `data-testid="equivalent-claim"` rows: name, note, MOQ/lead, and an `InquiryForm` with kind `quote`
  6. a "+ ARE YOU THE MILL? CLAIM THIS GARMENT" link to `/add`

**`InquiryForm`:** a `<button aria-expanded>` labelled with `label` ("Request swatch" or "Request quote"). Use a real button rather than `<details>/<summary>`, so Playwright's `getByRole('button')` finds it. When open, it renders the fields (and only then): name, email, company, quantity (m), message, a hidden `via`, and a visually hidden honeypot field `website`. The submit button is labelled "Send request", and on success the form shows "Request sent".

**`submitInquiryAction`:**
- A filled honeypot returns `ok` without saving.
- Zod parses the form.
- Calls `submitInquiry` with `agentHandleExists` (via the profile repository), `companyOwnerEmail` (company owner, then the user directory) and `baseUrl`.

**`resolveAgent`:** looks up the profile by handle only when it matches `/^[a-z0-9-]{3,40}$/`.

- [ ] **Step 4: Run it and check it passes**

Run: `pnpm e2e e2e/garment-page.spec.ts`. Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): garment page with swatch and quote requests"
```

---

### Task 13: Article and mill pages

**Files:**
- Create: `src/app/m/[company]/page.tsx`, `src/app/m/[company]/a/[article]/{page.tsx,edit-specs-form.tsx,actions.ts}`, `src/app/_components/copy-link-button.tsx`
- Create: `e2e/article-page.spec.ts`

**Interfaces:**
- Consumes: `getCompanyPageView` / `getArticlePageView` (Task 9), `editArticleSpecs` (Task 3), `InquiryForm` (Task 12), `getViewer`
- Produces:
  - `editArticleSpecsAction(prev: ActionResult | null, form: FormData): Promise<ActionResult>`
  - `CopyLinkButton({ url: string; label: string })` (client component, uses `navigator.clipboard.writeText`)

- [ ] **Step 1: Write the failing e2e spec**

```ts
test('article page shows the mill’s own garments only', async ({ page }) => {
  await page.goto('/m/indigo-mill/a/60219-1');
  await expect(page.getByRole('heading', { name: /60219\/1/ })).toBeVisible();
  await expect(page.getByText('Cropped Denim Blazer')).toBeVisible();
  await expect(page.getByText('Denizli Indigo')).toHaveCount(0);
  await expect(page.getByText('1,000 m', { exact: false })).toBeVisible();
});
test('an agent copies a link carrying their handle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, 'agent@example.test');
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: /copy link for agents/i }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:3100/m/indigo-mill/a/60219-1?via=lauramartin-demo');
});
test('the owner edits specs; others cannot see the form', async ({ page }) => {
  await page.goto('/m/indigo-mill/a/60219-1');
  await expect(page.getByRole('button', { name: /edit specs/i })).toHaveCount(0);
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: /edit specs/i }).click();
  await page.getByLabel(/moq/i).fill('1500');
  await page.getByRole('button', { name: /save specs/i }).click();
  await expect(page.getByText('1,500 m', { exact: false })).toBeVisible();
});
test('mill page lists articles', async ({ page }) => {
  await page.goto('/m/indigo-mill');
  await expect(page.getByRole('link', { name: /60219\/1/ })).toHaveAttribute('href', '/m/indigo-mill/a/60219-1');
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm e2e e2e/article-page.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the pages, the copy button and the edit action**

**Article page** (per the mockup's ARTICLE tab):
- breadcrumb `MILLS / <MILL> / <CODE>`
- display heading `ARTICLE <code>`
- spec strip: weight `12.5 oz`, composition, finish, `MOQ / lead` as `1,000 m · 3 wks` (formatted with `Intl.NumberFormat('en')`)
- the garments grid (tag ORIGINAL in accent, EQUIVALENT in muted)
- `InquiryForm` (kind `swatch`, `articleId`)
- `CopyLinkButton`: the URL is `${baseUrl}/m/${company}/a/${article}`, plus `?via=${handle}` when the viewer is an agent

**Owner only:** an "EDIT SPECS" disclosure containing `edit-specs-form.tsx`.

**`generateMetadata`:** title `` `Article ${code} by ${company}` ``, with an `og:image` from the first garment that has an image.

**Mill page:** a display heading with the mill name, `city, country`, article links, and the garments grid.

- [ ] **Step 4: Run it and check it passes**

Run: `pnpm e2e e2e/article-page.spec.ts`. Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): article and mill pages with agent share links"
```

---

### Task 14: Add garments page

**Files:**
- Create: `src/app/add/{page.tsx,add-garments-form.tsx,actions.ts}`
- Create: `e2e/add-garments.spec.ts`

**Interfaces:**
- Consumes: `requireMill`, `getContainer`, `ActionResult`, `toActionError` (Task 10), `importProduct` / `addProductManually` / `getProduct` (Task 5), `upsertArticle` (Task 3), `publishGarments` (Task 6)
- Produces:
  - `type PreviewRow = { url: string; state: 'ready'; productId: string; brand: string; name: string; imageUrl: string | null; composition: string | null } | { url: string; state: 'needs_details'; reason: 'fetch_failed' | 'not_a_product_page' } | { url: string; state: 'invalid'; error: string }`
  - `previewGarmentsAction(urlsText: string): Promise<ActionResult<PreviewRow[]>>`
  - `addManualProductAction(input: { url: string; brand: string; name: string }): Promise<ActionResult<PreviewRow>>`
  - `publishGarmentsAction(items: { productId: string; articleCode: string; kind: 'original' | 'equivalent' }[]): Promise<ActionResult<{ count: number }>>` (redirects to `/m/<company slug>` on success)

- [ ] **Step 1: Write the failing e2e spec**

```ts
test('mill pastes links, fixes a blocked one by hand, and publishes', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/add');
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html\nhttp://localhost:4010/blocked.html\nnot a url');
  await page.getByRole('button', { name: /fetch/i }).click();
  const rows = page.getByTestId('preview-row');
  await expect(rows.nth(0)).toContainText('Washed Denim Jacket');
  await expect(rows.nth(1)).toContainText(/couldn.t read this page/i);
  await expect(rows.nth(2)).toContainText(/not a valid link/i);
  await rows.nth(1).getByLabel(/brand/i).fill('ZARA');
  await rows.nth(1).getByLabel(/name/i).fill('Black Denim Overshirt');
  await rows.nth(1).getByRole('button', { name: /save/i }).click();
  await rows.nth(0).getByLabel(/article code/i).fill('60219/1');
  await rows.nth(1).getByLabel(/article code/i).fill('60777/2');
  await rows.nth(1).getByRole('radio', { name: /equivalent/i }).check();
  await page.getByRole('button', { name: /publish 2 garments/i }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill$/);
  await expect(page.getByText('Black Denim Overshirt')).toBeVisible();
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm e2e e2e/add-garments.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the actions and the page**

**`previewGarmentsAction`:**
- Split the text on newlines, trim, drop blanks and dedupe.
- More than 50 links → `toActionError(new DomainError('claims.batch_size_invalid'))`.
- Run `importProduct` with concurrency 5 (`Promise.all` over chunks of 5).
- A `DomainError` on a row gives `state: 'invalid'` with the mapped message. Use the copy "Not a valid link." for `product.url_invalid` and "We can't fetch private addresses." for `product.url_not_public`.

**`publishGarmentsAction`:** gets the company from `requireMill()`, then calls `publishGarments` with `getProduct` and `upsertArticle` bound to the container.

**Page** (per the mockup's ADD GARMENTS tab):
- **Left:** a textarea labelled "Brand links" and a FETCH button.
- **Right:** one `data-testid="preview-row"` per link, showing the image, `BRAND — Name`, a status line ("✓ Fetched · composition" / "Couldn't read this page" / the error), an "Article code" input, and an OUR FABRIC / EQUIVALENT radio pair (default OUR FABRIC). `needs_details` rows show Brand and Name inputs plus a SAVE button.
- **Bottom:** the orange "PUBLISH N GARMENTS" button, where N is the number of ready rows. It is disabled when N = 0. The hint line beside it reads "Our fabric shows as declared until verified."

- [ ] **Step 4: Run it and check it passes**

Run: `pnpm e2e e2e/add-garments.spec.ts`. Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): add garments by pasting brand links"
```

---

### Task 15: Home page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/find-garment-form.tsx`, `src/app/actions.ts`, `e2e/home.spec.ts`

**Interfaces:**
- Consumes: `findProductByUrl` (Task 5), `listRecentlyTagged` (Task 9), `GarmentTile` / `GarmentGrid` (Task 10)
- Produces:
  - `findGarmentAction(prev: { notFound: boolean } | null, form: FormData): Promise<{ notFound: boolean }>` (redirects to `/p/:id` when found)

- [ ] **Step 1: Write the failing e2e spec**

```ts
test('pasting a tagged garment link (with tracking params) opens its page', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/paste a garment link/i).fill('https://www.guess.eu/en/cropped-denim-blazer-W5RN12?utm_source=whatsapp');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${DEMO.products.guess}$`));
});
test('an untagged link says so and invites mills', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/paste a garment link/i).fill('https://example.com/nothing');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page.getByText(/no mill has tagged this garment yet/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /are you the mill/i })).toHaveAttribute('href', '/add');
});
test('recently tagged grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('garment-tile').first()).toBeVisible();
  await expect(page.getByText('1 original · 2 equiv.', { exact: false })).toBeVisible();
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm e2e e2e/home.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the home page** (per the mockup's HOME tab)

- **Hero:** a denim placeholder panel with the display text "Who made this fabric?" and the find bar (input plus orange FIND).
- **Strip:** "New this week" on the left and "Browse by brand ↗" on the right. Browse by brand is static text in Phase 1.
- **Grid:** "Recently tagged garments", from `listRecentlyTagged(12)`. Each tile carries `data-testid="garment-tile"` and a tag joining the parts that apply with ` · `: `n original` and `n equiv.`. Original tags use the accent colour.
- **Not found:** the message plus the "Are you the mill? Add it →" link.

- [ ] **Step 4: Run it and check it passes**

Run: `pnpm e2e e2e/home.spec.ts`. Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): home page with link lookup and recent garments"
```

---

### Task 16: Requests inbox and admin verification

**Files:**
- Create: `src/app/requests/{page.tsx,actions.ts}`, `src/app/admin/claims/{page.tsx,actions.ts}`
- Create: `e2e/requests-admin.spec.ts`

**Interfaces:**
- Consumes: `listCompanyInquiries` / `listDeclaredOriginals` (Task 9), `markInquiryAnswered` / `countNewInquiries` (Task 8), `verifyOriginalClaim` (Task 6), `requireMill` / `requireAdmin` (Task 10)
- Produces:
  - `markAnsweredAction(inquiryId: string): Promise<ActionResult>`
  - `verifyClaimAction(claimId: string): Promise<ActionResult>`

- [ ] **Step 1: Write the failing e2e spec**

```ts
test('mill sees credited requests and marks one answered', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/requests');
  const badge = page.getByTestId('new-requests-count');
  const before = Number(await badge.textContent());
  const row = page.getByTestId('inquiry-row').filter({ hasText: 'Seed Buyer Co' });
  await expect(row).toContainText('Via agent @lauramartin-demo');
  await expect(row).toContainText('GUESS — Cropped Denim Blazer');
  await row.getByRole('button', { name: /mark answered/i }).click();
  await expect(row).toContainText(/answered/i);
  if (before > 1) await expect(badge).toHaveText(String(before - 1));
  else await expect(badge).toHaveCount(0);
});
test('admin verifies a declared original', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/claims');
  await page.getByTestId('declared-original').filter({ hasText: 'LIU-JO' }).getByRole('button', { name: /verify/i }).click();
  await page.goto(`/p/${DEMO.products.liujo}`);
  await expect(page.getByTestId('original-claim')).toContainText('Verified');
});
test('non-admins are sent home', async ({ page }) => {
  await signIn(page, 'agent@example.test');
  await page.goto('/admin/claims');
  await expect(page).toHaveURL('http://localhost:3100/');
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm e2e e2e/requests-admin.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the requests page, the admin page and their actions**

**`/requests`:**
- A list of `data-testid="inquiry-row"` rows. Each shows kind, status, buyer name, company and `mailto:` email, `quantity m`, the message, the target link, `Via agent @handle`, the date, and MARK ANSWERED while the row is new.
- The action takes the company from `requireMill()`.

**`/admin/claims`:**
- `data-testid="declared-original"` rows (product `BRAND — Name` linked, mill name, date), each with a VERIFY button.
- An `already_verified_original` error is shown inline on the row.

- [ ] **Step 4: Run it, then the full suites**

Run: `pnpm e2e e2e/requests-admin.spec.ts`. Expected: 3 passed.

Then run: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`. Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(app): requests inbox and admin claim verification"
```

---

### Task 17: Deploy to Cloudflare Workers

> Needs the user: a Cloudflare account, a Neon project, a Resend domain, and the production domain name. Steps marked **(user)** use their accounts.

**Files:**
- Create: `wrangler.jsonc`, `open-next.config.ts`, `.dev.vars.example`, `docs/deploy.md`
- Modify: `package.json` (scripts), `src/server/container.ts`, `src/server/config.ts`, `src/server/config.test.ts`

**Interfaces:**
- Consumes: `getContainer` / `readConfig` (Task 10)
- Produces: `resolveDatabaseUrl(config: AppConfig, cf: { env: { HYPERDRIVE?: { connectionString: string } } } | null): string`

- [ ] **Step 1: Install the adapter**

```bash
pnpm add @opennextjs/cloudflare && pnpm add -D wrangler
```

Add these scripts:
- `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`
- `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"`
- `"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"`

- [ ] **Step 2: Write the failing config test, then implement `resolveDatabaseUrl`**

```ts
it('prefers DATABASE_URL, then Hyperdrive, then local PGlite', () => {
  const base = readConfig({ BETTER_AUTH_SECRET: 's'.repeat(32), PUBLIC_BASE_URL: 'https://xmanufacture.com' });
  expect(resolveDatabaseUrl({ ...base, databaseUrl: 'postgres://a' }, null)).toBe('postgres://a');
  expect(resolveDatabaseUrl(base, { env: { HYPERDRIVE: { connectionString: 'postgres://hd' } } })).toBe('postgres://hd');
  expect(resolveDatabaseUrl(base, null)).toBe('./.data/dev');
});
```

**Wiring:** `getContainer` calls `getCloudflareContext({ async: true })` inside try/catch (it throws outside Workers), then passes the result to `resolveDatabaseUrl`.

Run: `pnpm test src/server`. Expected: PASS.

- [ ] **Step 3: Create `wrangler.jsonc` and `open-next.config.ts`**

`wrangler.jsonc`:
- `name: "xmanufacture"`, `main: ".open-next/worker.js"`, `compatibility_date: "2026-10-01"`
- `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`
- `assets: { directory: ".open-next/assets", binding: "ASSETS" }`
- `services: [{ binding: "WORKER_SELF_REFERENCE", service: "xmanufacture" }]`
- `hyperdrive: [{ binding: "HYPERDRIVE", id: "<HYPERDRIVE_ID>", localConnectionString: "postgres://postgres:postgres@localhost:5432/xmanufacture" }]`
- `vars: { PUBLIC_BASE_URL, BETTER_AUTH_URL, MAIL_FROM }`

`open-next.config.ts`: `export default defineCloudflareConfig({})`. There's no incremental cache, because every page is dynamic.

- [ ] **Step 4: Write `docs/deploy.md` with the exact (user) commands**

1. Create a Neon project and copy its connection string.
2. `DATABASE_URL=<neon url> pnpm db:migrate`.
3. `pnpm wrangler hyperdrive create xmanufacture-db --connection-string="<neon url>"`, then paste the id into `wrangler.jsonc`.
4. Set the secrets with `pnpm wrangler secret put …`: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAILS`.
5. Verify the sending domain in Resend and set `MAIL_FROM`.
6. `pnpm deploy`.
7. Attach the custom domain in the Cloudflare dashboard.

- [ ] **Step 5: Verify locally in the Workers runtime**

Run: `docker run -d --name xm-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=xmanufacture -p 5432:5432 postgres:17`, then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/xmanufacture pnpm db:migrate && DATABASE_URL=postgres://postgres:postgres@localhost:5432/xmanufacture pnpm seed && pnpm preview`.

Expected: `http://localhost:8787/` shows recently tagged garments, and `/p/00000000-…` (`DEMO.products.guess`) renders the garment page.

- [ ] **Step 6: (user) Deploy and smoke-test**

Run: `pnpm deploy`.

Expected: the URL printed by Wrangler serves `/`, a magic-link email arrives through Resend, and pasting a real guess.eu product link on `/add` either fetches it or offers manual entry.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore(deploy): Cloudflare Workers via OpenNext with Hyperdrive"
```

---

## Later plans (not in this one)

- **Phase 2** (separate plan): proof upload for verification, team members and invites, Turkish UI (`next-intl`), garment makers as a second company kind, browse by brand and category, a scraping-service fallback for blocked sites, and a PWA share target.
- **Phase 3** (separate plan): mill subscriptions and paid visibility, visual search, and per-article analytics for mills.
