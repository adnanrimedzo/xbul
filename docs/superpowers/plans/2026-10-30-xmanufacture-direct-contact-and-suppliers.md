# xmanufacture: Direct Contact and Suppliers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the app in line with the brother's answers: remove agents and the request form, let buyers contact suppliers directly, add garment makers, use general supplier wording, verify claims from uploaded evidence, and count searches.

**Architecture:** Same modular monolith. Agents, profiles and the Inquiry context are deleted. Supplier gains contact details and a company kind. Claims gains a scope (fabric or garment) and an evidence review flow behind an `EvidenceStore` port (local files in dev, R2 on Workers). Catalog gains a search log, and Discovery gains platform stats.

**Tech Stack:** Next.js 16.4, TypeScript, Drizzle 0.45, PGlite (dev/test), Postgres + Cloudflare R2 (production), Vitest 5, Playwright 1.64. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-25-xmanufacture-design.md`. Section 11 is binding and overrides earlier sections where they conflict.

## Global Constraints

- **Next.js:** read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).
- **Boundaries:** domain files import only `@/shared/domain/*` and relative files. Across modules, import only the module's `index.ts`, or `infrastructure/*schema` for tables. Use cases are `async fn(deps, input)`.
- **Errors:** throw `DomainError(code)`. Every code needs English copy in `src/app/_lib/error-messages.ts`; a guard test enforces this.
- **Identity from the server:** company and user ids come from `requireMill()`/`requireAdmin()`/`getViewer()`, never from the client. Ids from the client pass `z.uuid()` first.
- **Copy:** DOM text is normal case; CSS uppercases it.
- **Code names stay:** table names, routes (`/m/`, `/p/`, `/add`), `requireMill` and test ids such as `garment-tile` don't change, even where the UI now says "supplier" or "product".
- **Migrations:** no production data exists, so no data migration is needed. Drizzle-kit prompts interactively when one `generate` both drops and adds columns, so run drops and adds as separate `pnpm db:generate --name=…` runs. Check each generated SQL file. After migrating, reset local data with `pnpm db:reset && pnpm seed` (stop any dev server on `.data/dev` first).
- **Commits:** one per task, staging named files only. Never stage `.claude/`, `.idea/` or `.env.local`. End every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Every task ends with:** `pnpm test && pnpm lint && pnpm typecheck && pnpm e2e` all passing. Next.js allows one `next dev` per project folder, so stop any dev server already running here before running e2e.
- **Evidence limits:** PDF, JPG or PNG; at most 5 files per claim; at most 10 MB each.

## Review Focus

1. **A website that isn't a web address** (`javascript:alert(1)`, `ftp://x`), or a bare `taypa.com`. The first two are refused; the bare domain becomes `https://taypa.com/`. Test: Task 2.
2. **A file renamed to `.pdf` that isn't one.** It's refused by its bytes, not its name or claimed type. Test: Task 6.
3. **A visitor or another supplier guessing an evidence URL.** They get a 404, the same as for an id that doesn't exist. Test: Task 7 e2e, Task 6 unit.
4. **Two suppliers verified on one product.** A mill and a garment maker can both be verified; a second mill can't. Test: Task 4.
5. **The search log failing.** The buyer's search still works. Test: Task 8.

---

### Task 1: Remove agents and profiles

**Files:**
- Delete: `src/app/_lib/resolve-agent.ts`, `src/modules/identity/domain/` (all), `src/modules/identity/application/` (all), `src/modules/identity/infrastructure/schema.ts`, `src/modules/identity/infrastructure/drizzle-profile-repository.ts`
- Modify: `src/modules/identity/index.ts`, `src/server/viewer.ts`, `src/server/container.ts`, `src/server/seed-demo.ts`, `src/server/demo-ids.ts`, `src/app/onboarding/{page.tsx,onboarding-form.tsx,actions.ts}`, `src/app/_actions/submit-inquiry.ts`, `src/app/_actions/submit-inquiry.test.ts`, `src/app/_components/{inquiry-form.tsx,copy-link-button.tsx}`, `src/app/_lib/error-messages.ts`, `src/app/p/[id]/page.tsx`, `src/app/m/[company]/a/[article]/page.tsx`, `src/app/_components/chrome/site-footer.tsx`
- Test: `e2e/onboarding.spec.ts`, `e2e/garment-page.spec.ts`, `e2e/article-page.spec.ts`, `e2e/requests-admin.spec.ts`
- Create: `drizzle/0008_drop-profiles.sql` (generated)

**Interfaces:**
- Produces: `type Viewer = { userId: string; email: string; isAdmin: boolean; company: Company | null }`, and `completeOnboardingAction(prev, form)` reading `companyName`, `city` and `country`.
- Produces: `DEMO` without `users.agent`, `emails.agent` or `agentHandle`.

- [ ] **Step 1: Update the e2e specs first**

`e2e/onboarding.spec.ts`: delete the agent test. In the other two, remove the radio and "Your name" lines. Add:

```ts
test('someone who already has a company skips onboarding', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await expect(page).toHaveURL(/\/add$/);
});
```

`e2e/garment-page.spec.ts`:
- Delete the "tampered via" and "agent copies" tests.
- Remove `?via=…` and the "shared by agent" assertion from the swatch test, and rename it `buyer requests a swatch`.
- Remove its `Via agent:` mail assertion.

Add:

```ts
test('the copied garment link carries no handle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(url);
  await page.getByRole('button', { name: /copy link/i }).click();
  await expect(page.getByRole('button', { name: /copied/i })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3100/p/${DEMO.products.guess}`);
});
```

`e2e/article-page.spec.ts`: replace the agent test with the same check on `/m/indigo-mill/a/60219-1`, using the button `/copy link/i`, signed out.

`e2e/requests-admin.spec.ts`:
- Remove the `Via agent @…` assertion.
- Make "non-admins are sent home" sign in as `mill@example.test`.

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm e2e e2e/onboarding.spec.ts e2e/garment-page.spec.ts e2e/article-page.spec.ts`
Expected: FAIL on the new tests and on the removed form fields.

- [ ] **Step 3: Delete the agent and profile code**

- `Viewer` loses `profile`.
- `Container` loses `profiles`.
- The onboarding page redirects to `/add` when `viewer.company` exists.
- The form has only Company name, City and Country.
- The action calls `registerCompany(createSupplierRepositories(db), { name, city, country, ownerUserId: viewer.userId })` with no transaction (one write), then redirects to `/add`.
- Remove the `via` prop from `InquiryForm`, and pass `viaAgentHandle: null` in `submitInquiryAction`. The Inquiry module itself goes in Task 2.
- Pages: delete the agent banner, `resolveAgent` and the `?via=` logic. Share URLs are the plain page URL. The article button label becomes "Copy link".
- Footer: "About · For mills · Terms".
- Error messages: remove `profile.*`.
- Lower the code-count floor in `src/app/_lib/action-result.test.ts` to `> 15`.
- `seed-demo.ts` no longer creates profiles or the agent user.

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate --name=drop-profiles`. Expected: `drizzle/0008_drop-profiles.sql` drops `profiles`.

- [ ] **Step 5: Verify and commit**

Run the "every task ends with" checks. Expected: all pass.

```bash
git commit -m "refactor: remove agents and profiles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Direct supplier contact replaces the request form

**Files:**
- Delete: `src/modules/inquiry/` (all), `src/app/_actions/submit-inquiry.ts`, `src/app/_actions/submit-inquiry.test.ts`, `src/app/_components/inquiry-form.tsx`, `src/app/requests/` (all), `src/modules/discovery/infrastructure/company-inquiries.ts`, `src/modules/identity/infrastructure/user-directory.ts`
- Create: `src/app/_components/supplier-contact.tsx`, `src/app/m/[company]/edit-contact-form.tsx`, `src/modules/supplier/application/update-company-contact.ts`, `drizzle/0009_drop-inquiries.sql`, `drizzle/0010_company-contact.sql` (generated)
- Modify: `src/modules/supplier/domain/company.ts`, `domain/company.test.ts`, `application/register-company.ts`, `application/supplier.test.ts`, `infrastructure/schema.ts`, `infrastructure/drizzle-repositories.ts`, `index.ts`; `src/modules/discovery/infrastructure/{types.ts,product-page-view.ts,article-page-view.ts,company-page-view.ts,discovery.test.ts}`, `src/modules/discovery/index.ts`, `src/modules/identity/index.ts`; `src/shared/mail/{mailer.ts,mailer.test.ts}`; `src/server/{container.ts,seed-demo.ts,container.test.ts}`; `src/app/layout.tsx`, `src/app/_components/chrome/site-nav.tsx`, `src/app/_lib/error-messages.ts`, `src/app/p/[id]/page.tsx`, `src/app/m/[company]/{page.tsx,actions.ts,actions.test.ts}`, `src/app/m/[company]/a/[article]/page.tsx`, `src/app/onboarding/{onboarding-form.tsx,actions.ts}`
- Test: rename `e2e/requests-admin.spec.ts` to `e2e/admin.spec.ts`; update `e2e/garment-page.spec.ts`, `e2e/onboarding.spec.ts`, `e2e/article-page.spec.ts`

**Interfaces:**
- Produces, from `@/modules/supplier`:
  - `type CompanyContact = Readonly<{ email: string | null; phone: string | null; website: string | null }>`
  - `Company` gains `contact: CompanyContact`
  - `createCompany(input: { name; city; country; ownerUserId; contact: { email?: string | null; phone?: string | null; website?: string | null } }, now?)`
  - `normalizeContact(input): CompanyContact`
  - `updateCompanyContact(deps: { companies: CompanyRepository }, input: { userId: string; contact: {...} }): Promise<Company>`
- Produces, from `@/modules/discovery`: `CompanyRef` gains `contact: CompanyContact`.
- Produces: `SupplierContact({ contact }: { contact: CompanyContact })`, rendering `data-testid="supplier-contact"`.
- Removes: `Container.inquiries`, `Container.users`, `MailMessage.replyTo`, `listCompanyInquiries`, `InquiryRow`, `createUserDirectory`.

- [ ] **Step 1: Write the failing domain tests** (`company.test.ts`; update existing `createCompany` calls to pass `contact: { email: 'sales@x.test' }`)

```ts
it('needs at least one way to reach the supplier', () => {
  expect(() => normalizeContact({})).toThrow(expect.objectContaining({ code: 'company.contact_required' }));
  expect(() => normalizeContact({ email: ' ', phone: '', website: null })).toThrow(expect.objectContaining({ code: 'company.contact_required' }));
});
it('normalizes contact details', () => {
  expect(normalizeContact({ email: ' Sales@Taypa.TEST ', phone: ' +90 (212) 555-0100 ', website: 'taypa.com' }))
    .toEqual({ email: 'sales@taypa.test', phone: '+90 (212) 555-0100', website: 'https://taypa.com/' });
});
it.each([
  [{ email: 'not-an-email' }, 'company.email_invalid'],
  [{ email: `${'a'.repeat(250)}@x.test` }, 'company.email_invalid'],
  [{ phone: 'call me' }, 'company.phone_invalid'],
  [{ website: 'javascript:alert(1)' }, 'company.website_invalid'],
  [{ website: 'ftp://taypa.com' }, 'company.website_invalid'],
  [{ website: `https://x.test/${'a'.repeat(2050)}` }, 'company.website_invalid'],
])('rejects %j', (contact, code) => expect(() => normalizeContact(contact)).toThrow(expect.objectContaining({ code })));
```

Rules:
- Email: lowercased, at most 254 characters, `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- Phone: `/^\+?[0-9 ()-]{6,30}$/`.
- Website: at most 2048 characters. Prefix `https://` when the value has no `://` and doesn't match `^[a-z]+:`. Parse with `URL.canParse`, require protocol `http:` or `https:`, and store `.href`.

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm test src/modules/supplier`. Expected: FAIL (`normalizeContact` missing).

- [ ] **Step 3: Implement the domain, `updateCompanyContact`, the schema and the repository**

- Schema adds nullable `contact_email`, `contact_phone` and `website`. The repository maps them to and from `contact`.
- `updateCompanyContact` finds the company by owner (`auth.forbidden` if none), normalizes, saves and returns it.
- Add a test in `supplier.test.ts`: the owner updates and a round trip returns the new contact; a user with no company gets `auth.forbidden`.
- Add error copy: `company.contact_required` "Add an email, phone or website so buyers can reach you.", `company.email_invalid` "Enter a valid email address.", `company.phone_invalid` "Enter a valid phone number.", `company.website_invalid` "Enter a valid website address."

- [ ] **Step 4: Delete the Inquiry context and everything that uses it**

- Remove the Requests nav link and `newRequests` from `SiteNav` and the layout.
- Remove `replyTo` from the mailer and its tests.
- Remove all `inquiry.*` copy.
- Remove the seed's inquiry and the inquiry tests in `discovery.test.ts`.
- `seed-demo.ts`: give each company a contact (`sales@<slug>.example`, and a website for Indigo).
- `mailer` stays for magic links.

- [ ] **Step 5: Generate the two migrations, drop first**

Temporarily comment out the three new `companies` columns in `schema.ts`, then run `pnpm db:generate --name=drop-inquiries`. Restore the columns, then run `pnpm db:generate --name=company-contact`.

Expected: `0009` drops `inquiries`, and `0010` adds the three columns.

- [ ] **Step 6: Write the failing e2e tests**

Update `e2e/garment-page.spec.ts`: delete `buyer requests a swatch` and add:

```ts
test('a visitor can reach the original supplier and an equivalent directly, with no account', async ({ page }) => {
  await page.goto(url);
  const original = page.getByTestId('original-claim');
  await expect(original).toContainText('Indigo Mill');
  await expect(original).toContainText('Verified');
  await expect(original).toContainText('60219/1');
  await expect(original.getByRole('link', { name: 'sales@indigo-mill.example' })).toHaveAttribute('href', 'mailto:sales@indigo-mill.example');
  await expect(page.getByTestId('equivalent-claim').first().getByTestId('supplier-contact')).toBeVisible();
  await expect(page.getByRole('button', { name: /request/i })).toHaveCount(0);
});
```

`e2e/admin.spec.ts`: delete the request and overflow tests, and assert `page.goto('/requests')` is a 404.

`e2e/onboarding.spec.ts`: fill the new "Contact email" field in the success test. Add a test that submits no contact and sees "Add an email, phone or website so buyers can reach you."

`e2e/article-page.spec.ts`: add a test that the owner edits contact details on `/m/indigo-mill`: open "Edit contact details", set "Phone" to `+90 212 555 0100`, click "Save contact", and expect a link with `href="tel:+902125550100"`. Add an assertion that anonymous visitors get no such button.

- [ ] **Step 7: Build the UI**

`SupplierContact` renders whichever exist:
- `mailto:${encodeURIComponent(email).replace('%40','@')}`
- `tel:` with spaces and punctuation stripped (keep a leading `+`)
- the website link with `target="_blank" rel="noopener nofollow ugc"`, its text being the host without `www.`

Use `break-all` so long values wrap.

Use it in:
- each original and equivalent on the garment page, replacing `InquiryForm`
- the article page header, replacing `InquiryForm`
- the mill page header

Onboarding gains "Contact email" (default `viewer.email`), "Phone" and "Website"; the action echoes them on error as it does the other fields.

The mill page gains an owner-only `EditContactForm` disclosure, labelled "Edit contact details" with a "Save contact" button, which calls `updateContactAction(prev, form)` in `src/app/m/[company]/actions.ts`. It calls `requireMill()`, then `updateCompanyContact`, then `revalidatePath('/', 'layout')`. Add a unit test in `actions.test.ts`: a bad website returns the copy, and the input has no company id at all.

- [ ] **Step 8: Verify and commit**

Run the "every task ends with" checks. Expected: all pass, with no `inquir` left: `grep -ri inquir src e2e` prints nothing.

```bash
git commit -m "feat: buyers contact suppliers directly; remove the request form" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Free-text specs

**Files:**
- Modify: `src/modules/supplier/domain/{article.ts,article.test.ts}`, `infrastructure/{schema.ts,drizzle-repositories.ts}`, `src/modules/discovery/infrastructure/{product-page-view.ts,article-page-view.ts,discovery.test.ts}`, `src/server/seed-demo.ts`, `src/app/_lib/error-messages.ts`, `src/app/p/[id]/page.tsx`, `src/app/m/[company]/a/[article]/{page.tsx,edit-specs-form.tsx,actions.ts,actions.test.ts}`
- Test: `e2e/article-page.spec.ts`
- Create: `drizzle/0011_drop-numeric-specs.sql`, `drizzle/0012_text-specs.sql` (generated)

**Interfaces:**
- Produces: `type ArticleSpecs = Readonly<{ weight: string | null; composition: string | null; finish: string | null; moq: string | null; leadTimeWeeks: number | null }>`.

- [ ] **Step 1: Write the failing test** (`article.test.ts`, replacing the numeric weight and MOQ cases)

```ts
it('takes weight and MOQ as free text in the supplier’s own units', () => {
  const a = createArticle({ companyId: 'c1', code: '60219/1' });
  expect(withSpecs(a, { weight: ' 240 g/m² ', moq: '500 pieces' }).specs).toMatchObject({ weight: '240 g/m²', moq: '500 pieces' });
  expect(withSpecs(a, { weight: '', moq: '' }).specs).toMatchObject({ weight: null, moq: null });
  expect(() => withSpecs(a, { moq: 'x'.repeat(61) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
  expect(() => withSpecs(a, { weight: 'x'.repeat(61) })).toThrow(expect.objectContaining({ code: 'article.text_too_long' }));
});
```

- [ ] **Step 2: Run it and check it fails**

Run: `pnpm test src/modules/supplier/domain/article`. Expected: FAIL.

- [ ] **Step 3: Implement**

- Weight and MOQ: at most 60 characters. Lead time stays an integer from 0 to 52.
- Remove `article.weight_invalid` and `article.moq_invalid`.
- `article.text_too_long` copy: "Weight and MOQ must be 60 characters or fewer, composition 120 and finish 80."
- Seed: `weight: '12.5 oz'`, `moq: '1,000 m'`.
- Form: text inputs labelled "Weight" (placeholder `12.5 oz or 240 g/m²`) and "MOQ" (placeholder `1,000 m or 500 pieces`).
- Pages show the text as entered: the chip reads `MOQ ${moq}`; the article strip shows `moq · N wks`.

- [ ] **Step 4: Generate the two migrations, drop first**

Comment out the new columns, then `pnpm db:generate --name=drop-numeric-specs` (drops `weight_oz`, `moq_meters`). Restore them, then `pnpm db:generate --name=text-specs` (adds `weight`, `moq`).

- [ ] **Step 5: Update the e2e and action tests**

In `e2e/article-page.spec.ts`, the edit test fills `/moq/i` with `1,500 m`. Discovery tests expect `specs.moq` to be `'1,000 m'` and `specs.weight` to be `'12.5 oz'`.

- [ ] **Step 6: Verify and commit**

Run the "every task ends with" checks. Expected: all pass.

```bash
git commit -m "feat(supplier): specs are free text in the supplier's own units" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Garment makers

**Files:**
- Modify: `src/modules/supplier/domain/{company.ts,company.test.ts}`, `application/register-company.ts`, `infrastructure/drizzle-repositories.ts`, `index.ts`; `src/modules/claims/domain/{claim.ts,claim.test.ts,repositories.ts}`, `application/{publish-garments.ts,verify-original-claim.ts,claims.test.ts}`, `infrastructure/{schema.ts,drizzle-claim-repository.ts}`, `index.ts`; `src/modules/discovery/infrastructure/{types.ts,product-page-view.ts,article-page-view.ts,company-page-view.ts,discovery.test.ts}`; `src/server/{seed-demo.ts,demo-ids.ts}`; `src/app/add/{actions.ts,actions.test.ts}`, `src/app/onboarding/{onboarding-form.tsx,actions.ts}`, `src/app/p/[id]/page.tsx`, `src/app/m/[company]/page.tsx`
- Test: `e2e/garment-page.spec.ts`, `e2e/onboarding.spec.ts`, `e2e/home.spec.ts`
- Create: `drizzle/0013_claim-scope.sql` (generated)

**Interfaces:**
- Produces, from `@/modules/supplier`: `type CompanyKind = 'fabric_mill' | 'garment_maker'`; `Company.kind: CompanyKind`; `createCompany` input gains `kind`; `claimScopeOf(kind: CompanyKind): 'fabric' | 'garment'`.
- Produces, from `@/modules/claims`: `type ClaimScope = 'fabric' | 'garment'`; `Claim.scope`; `declareClaim` input gains `scope`; `publishGarments` input gains `scope`; `ClaimRepository.findVerifiedOriginal(productId, scope)`.
- Produces, from `@/modules/discovery`: `type ClaimGroup = { originals: ClaimView[]; equivalents: ClaimView[] }`; `ProductPageView = { product; fabric: ClaimGroup; garment: ClaimGroup }`; `CompanyRef` gains `kind: CompanyKind`.
- Produces: `DEMO` gains `users.maker`, `emails.maker: 'maker@example.test'`, `companies.anka`, `companySlugs.anka: 'anka-garments'`.

- [ ] **Step 1: Write the failing tests**

```ts
// company.test.ts
it('rejects an unknown kind', () =>
  expect(() => createCompany({ name: 'Taypa', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact: { email: 'a@b.test' }, kind: 'wizard' as never }))
    .toThrow(expect.objectContaining({ code: 'company.kind_invalid' })));
it.each([['fabric_mill', 'fabric'], ['garment_maker', 'garment']] as const)('%s claims %s', (kind, scope) => expect(claimScopeOf(kind)).toBe(scope));

// claims.test.ts: setup() adds a garment-maker company `anka`
it('allows one verified original per scope, so a mill and a garment maker can both be verified', async () => {
  const { deps, ids } = await setup();
  const [mill] = await publishGarments(deps, { companyId: ids.indigo, scope: 'fabric', items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  const [rival] = await publishGarments(deps, { companyId: ids.denizli, scope: 'fabric', items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  const [maker] = await publishGarments(deps, { companyId: ids.anka, scope: 'garment', items: [{ productId: ids.guess, articleCode: null, kind: 'original' }] });
  expect((await verifyOriginalClaim(deps, mill.id)).status).toBe('verified');
  expect((await verifyOriginalClaim(deps, maker.id)).status).toBe('verified');
  await expect(verifyOriginalClaim(deps, rival.id)).rejects.toMatchObject({ code: 'claim.already_verified_original' });
  await expect(deps.claims.save(verifyClaim(rival))).rejects.toThrow(); // the partial unique index, per scope
});

// discovery.test.ts: replaces the garment page test
it('splits the garment page into who made the fabric and who made the garment', async () => {
  const v = await getProductPageView(db, DEMO.products.guess);
  expect(v?.fabric.originals.map((c) => [c.company.name, c.status, c.article?.code])).toEqual([['Indigo Mill', 'verified', '60219/1']]);
  expect(v?.fabric.equivalents.map((c) => c.company.name)).toEqual(['Denizli Indigo', 'Bursa Weave']);
  expect(v?.garment.originals.map((c) => [c.company.name, c.company.kind, c.status])).toEqual([['Anka Garments', 'garment_maker', 'verified']]);
  expect(v?.garment.equivalents).toEqual([]);
});
```

In `discovery.test.ts`, the recently tagged expectation becomes `[['EMPORIO ARMANI', 0, 1], ['LIU-JO', 1, 0], ['GUESS', 2, 2]]`, and the mill page's Guess tile becomes `{ originals: 2, equivalents: 2 }`. Existing `createCompany` and `registerCompany` calls in tests pass `kind: 'fabric_mill'`, and `publishGarments` calls pass `scope: 'fabric'`.

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm test src/modules`. Expected: FAIL.

- [ ] **Step 3: Implement the domain, schema, repository and read model**

- Claims schema: add `scope text not null default 'fabric'`, and change the partial index to `.on(t.productId, t.scope)`.
- `redeclareClaim` keeps the scope.
- `verifyOriginalClaim` looks up `findVerifiedOriginal(claim.productId, claim.scope)`.
- Add error copy `company.kind_invalid` "Choose fabric or garments."
- Update `claim.already_verified_original` to "Another supplier is already verified as the original for this product."

Seed: add company **Anka Garments** (`garment_maker`, Istanbul, contact `sales@anka-garments.example`) with owner `maker`, and a verified original Guess claim, inserted **second** in the claims list so the later ordering stays as it is.

Run: `pnpm db:generate --name=claim-scope`. Check the SQL recreates the index with both columns.

- [ ] **Step 4: Update the e2e specs**

```ts
// garment-page.spec.ts
test('the garment page shows who made the fabric and who made the garment', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('fabric-suppliers').getByTestId('original-claim')).toContainText('Indigo Mill');
  const garment = page.getByTestId('garment-suppliers');
  await expect(garment.getByTestId('original-claim')).toContainText('Anka Garments');
  await expect(garment.getByTestId('original-claim')).toContainText('Verified');
});

// onboarding.spec.ts
test('a garment maker registers and its claims count as garment claims', async ({ page }) => {
  await signIn(page, 'new-maker@example.test');
  await page.getByRole('radio', { name: /we make garments/i }).check();
  await page.getByLabel(/company name/i).fill('Yeni Konfeksiyon');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('a@yeni.test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/add$/);
  await page.goto('/m/yeni-konfeksiyon');
  await expect(page.getByText('Garment maker')).toBeVisible();
});
```

Other onboarding tests check `/we make fabric/i` first. In `e2e/home.spec.ts`, the tile tag becomes `'2 original · 2 equiv.'`. In `e2e/garment-page.spec.ts`, the original-claim assertions from Task 2 are scoped inside `fabric-suppliers`, and the OG test expects `Fabric by Indigo Mill (article 60219/1) · Garment by Anka Garments · 2 suppliers can make an equivalent`.

- [ ] **Step 5: Build the UI**

- Onboarding: required radios named `kind`: "We make fabric" and "We make garments". Zod enum; echoed on error.
- `src/app/add/actions.ts`: `publishGarments` gets `scope: claimScopeOf(company.kind)`. Add a test in `actions.test.ts`: a garment maker's publish saves a claim with `scope: 'garment'`.
- Garment page: a local `SupplierSection({ title, testId, group })`, rendered twice with titles "Who made the fabric" (`fabric-suppliers`) and "Who made the garment" (`garment-suppliers`). Hide a section with no claims. Inside it, keep the existing original blocks and the "Can make an equivalent" list.
- Metadata: as in the OG test; "1 supplier" in the singular.
- Mill page: under the name, show "Fabric mill" or "Garment maker". The metadata title becomes `${name} — ${kind label}`.

- [ ] **Step 6: Verify and commit**

Run the "every task ends with" checks. Expected: all pass.

```bash
git commit -m "feat: garment makers alongside fabric mills, each verified per scope" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: General wording, no Istanbul clock

**Files:**
- Delete: `src/app/_components/chrome/{istanbul-clock.tsx,format-clock.ts,format-clock.test.ts}`
- Modify: `src/app/_components/chrome/{site-header.tsx,site-nav.tsx,site-footer.tsx,ticker.tsx}`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/find-garment-form.tsx`, `src/app/not-found.tsx`, `src/app/add/{add-garments-form.tsx,actions.ts}`, `src/app/_lib/error-messages.ts`, `src/app/p/[id]/page.tsx`, `src/app/m/[company]/page.tsx`, `src/app/m/[company]/a/[article]/page.tsx`, `src/app/onboarding/page.tsx`, `README.md`, `docs/deploy.md`
- Test: `e2e/{home,add-garments,article-page,garment-page,smoke}.spec.ts`

**Interfaces:** none new.

- [ ] **Step 1: Update the e2e specs to the new copy, then see them fail**

Exact new strings:

| Where | Old | New |
|---|---|---|
| Home `h1` | Who made this fabric? | `Who made this?` |
| Find placeholder | Paste a garment link… | `Paste a product link from any brand's site` |
| Not tagged | No mill has tagged this garment yet. | `No supplier has tagged this product yet.` |
| Not tagged link | Are you the mill? Add it → | `Are you the supplier? Add it →` |
| Home heading | Recently tagged garments | `Recently tagged products` |
| Home empty | No garments tagged yet. | `No products tagged yet.` |
| Nav | Mills / Add garment | `My company` / `Add products` |
| Footer | About · For mills · Terms | `About · For suppliers · Terms` |
| Ticker | (all) | `Find the supplier behind any product`, `Paste a link, see who made it`, `Contact suppliers directly`, `Free to search` |
| Layout description | Find the mill behind any garment. | `Find the supplier behind any product.` |
| Add heading / labels | Add garments / Brand links / Article code / Our fabric | `Add products` / `Brand links` / `Product code` / `We made this` |
| Add button | Publish N garments | `Publish N products` |
| Add hint | Our fabric shows as declared… | `"We made this" shows as declared until verified.` |
| Garment page link | Are you the mill? Claim this garment | `Are you a supplier? Claim this product` |
| Garment page chip | Article 60219/1 | `Code 60219/1` |
| Article page `h1`, breadcrumb | Article … / Mills / | `Code …` / `Suppliers /` |
| Article page bar | Linked to N garments | `Linked to N products` |
| Mill page | Articles / Garments / No garments linked yet. | `Product codes` / `Products` / `No products linked yet.` |
| Not-found page | any mention of garment or mill | `product`, `supplier` |

Error copy: replace "mill" with "supplier", "garment" with "product" and "Article code" with "Product code" in `article.*`, `claim.*`, `claims.*`, `product.*`. The `product.url_invalid` and `product.url_not_public` strings stay.

Also in `e2e/garment-page.spec.ts`'s 404 test, remove the `ISTANBUL, TR` assertion. In `smoke.spec.ts`, replace it with the wordmark check.

Run: `pnpm e2e e2e/home.spec.ts`. Expected: FAIL.

- [ ] **Step 2: Apply the copy and remove the clock**

`SiteHeader` shows only the wordmark. The heading is written `Who made{' '}<br />this?`, so its text keeps the space. The hero still uses the denim placeholder: clothing comes first, and a neutral visual can wait.

Rewrite the README's opening and demo-login sections to match: buyers contact suppliers directly, no agents, and add `maker@example.test`. In `docs/deploy.md`, remove "mill" and "agent" wording.

- [ ] **Step 3: Check nothing was missed**

Run: `grep -rnEi "\bmills?\b|agent|swatch|istanbul" src/app --include='*.tsx'`
Expected: only `Fabric mill` on the mill page and code identifiers such as `MillPage`, `requireMill` and `mill-garment`. Update comments too.

- [ ] **Step 4: Verify and commit**

Run the "every task ends with" checks. Expected: all pass.

```bash
git commit -m "feat(app): general supplier and product wording; remove the Istanbul clock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Evidence review domain and storage

**Files:**
- Create: `src/modules/claims/domain/{evidence.ts,evidence.test.ts}`, `src/modules/claims/application/{ports.ts,evidence.ts,evidence.test.ts}`, `src/modules/claims/infrastructure/{drizzle-evidence-repository.ts,local-evidence-store.ts,r2-evidence-store.ts,evidence-stores.test.ts}`, `drizzle/0014_claim-evidence.sql` (generated)
- Modify: `src/modules/claims/domain/{claim.ts,claim.test.ts,repositories.ts}`, `application/withdraw-claim.ts`, `application/claims.test.ts`, `infrastructure/{schema.ts,drizzle-claim-repository.ts}`, `index.ts`, `src/app/_lib/error-messages.ts`, `src/app/m/[company]/actions.ts`, `src/app/m/[company]/actions.test.ts`
- Keep: `src/modules/claims/application/verify-original-claim.ts` for now. The admin page still uses it, and Task 7 removes it.

**Interfaces:**
- Produces, from `@/modules/claims`:
  - `type ReviewStatus = 'none' | 'pending' | 'rejected'`; `Claim` gains `reviewStatus`, `reviewNote: string | null`, `reviewedBy: string | null`, `reviewedAt: Date | null`
  - `type Evidence = Readonly<{ id: string; claimId: string; fileName: string; contentType: 'application/pdf' | 'image/jpeg' | 'image/png'; sizeBytes: number; storageKey: string; createdAt: Date }>`
  - `submitForReview(claim, now?)`, `approveReview(claim, adminUserId, now?)`, `rejectReview(claim, adminUserId, note, now?)`
  - `sniffEvidenceType(bytes: Uint8Array)`, `createEvidence(input: { claimId: string; fileName: string; bytes: Uint8Array }, now?)`
  - `interface EvidenceRepository { save(e): Promise<void>; findById(id): Promise<Evidence | null>; listByClaim(claimId): Promise<Evidence[]>; delete(id): Promise<void>; deleteByClaim(claimId): Promise<void> }`
  - `interface EvidenceStore { put(key: string, bytes: Uint8Array, contentType: string): Promise<void>; get(key: string): Promise<Uint8Array | null>; delete(key: string): Promise<void> }`
  - with `type EvidenceDeps = { claims: ClaimRepository; evidence: EvidenceRepository; store: EvidenceStore }`:
    - `addEvidence(deps, { companyId, claimId, fileName, bytes }): Promise<Evidence>`
    - `removeEvidence(deps, { companyId, evidenceId }): Promise<void>`
    - `submitClaimForReview(deps, { companyId, claimId }): Promise<Claim>`
    - `readEvidence(deps, { evidenceId, viewer: { isAdmin: boolean; companyId: string | null } }): Promise<{ evidence: Evidence; bytes: Uint8Array } | null>`
    - `approveClaimReview(deps, { claimId, adminUserId }): Promise<Claim>`
    - `rejectClaimReview(deps, { claimId, adminUserId, note }): Promise<Claim>`
  - `withdrawClaim` deps become `EvidenceDeps`
  - `createEvidenceRepository(db)`, `createLocalEvidenceStore(dir)`, `createR2EvidenceStore(bucket: { put(k: string, v: Uint8Array, o: { httpMetadata: { contentType: string } }): Promise<unknown>; get(k: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>; delete(k: string): Promise<unknown> })`

- [ ] **Step 1: Write the failing domain tests** (`evidence.test.ts`)

```ts
const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);

it.each([[PDF, 'application/pdf'], [PNG, 'image/png'], [JPG, 'image/jpeg']])('recognises the type from the bytes', (bytes, type) =>
  expect(sniffEvidenceType(bytes)).toBe(type));
it('refuses a file whose bytes aren’t an allowed type, whatever its name', () =>
  expect(() => createEvidence({ claimId: 'c1', fileName: 'invoice.pdf', bytes: new TextEncoder().encode('<script>') }))
    .toThrow(expect.objectContaining({ code: 'evidence.type_invalid' })));
it('refuses empty and oversize files', () => {
  expect(() => createEvidence({ claimId: 'c1', fileName: 'a.pdf', bytes: new Uint8Array(0) })).toThrow(expect.objectContaining({ code: 'evidence.type_invalid' }));
  const big = new Uint8Array(10 * 1024 * 1024 + 1); big.set(PDF);
  expect(() => createEvidence({ claimId: 'c1', fileName: 'a.pdf', bytes: big })).toThrow(expect.objectContaining({ code: 'evidence.too_large' }));
});
it('cleans the file name and never uses it in the storage key', () => {
  const e = createEvidence({ claimId: 'c1', fileName: '../../etc/pass\u0000wd.pdf', bytes: PDF });
  expect(e.fileName).toBe('passwd.pdf');
  expect(e.storageKey).toBe(`evidence/c1/${e.id}`);
});
```

And in `claim.test.ts`:

```ts
it('moves through review', () => {
  const claim = declareClaim(base);
  const pending = submitForReview(claim);
  expect(pending.reviewStatus).toBe('pending');
  expect(() => submitForReview(pending)).toThrow(expect.objectContaining({ code: 'claim.already_in_review' }));
  const approved = approveReview(pending, 'admin1');
  expect(approved).toMatchObject({ status: 'verified', reviewStatus: 'none', reviewedBy: 'admin1' });
  const rejected = rejectReview(pending, 'admin1', ' Invoice is unreadable ');
  expect(rejected).toMatchObject({ status: 'declared', reviewStatus: 'rejected', reviewNote: 'Invoice is unreadable' });
  expect(() => rejectReview(pending, 'admin1', ' ')).toThrow(expect.objectContaining({ code: 'claim.review_note_invalid' }));
  expect(() => approveReview(claim, 'admin1')).toThrow(expect.objectContaining({ code: 'claim.not_in_review' }));
  expect(() => submitForReview(declareClaim({ ...base, kind: 'equivalent' }))).toThrow(expect.objectContaining({ code: 'claim.only_original_verifiable' }));
});
it('a changed fact cancels a pending review', () =>
  expect(redeclareClaim(submitForReview(declareClaim(base)), { articleId: 'b', kind: 'original' }).reviewStatus).toBe('none'));
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm test src/modules/claims/domain`. Expected: FAIL.

- [ ] **Step 3: Implement the domain**

- `sniffEvidenceType`: `%PDF-`; PNG's 8-byte signature; `FF D8 FF`.
- File name: take the part after the last `/` or `\`, strip control characters, cut to 120 characters, and fall back to `evidence` when empty.
- Review note: 1–500 characters after trimming.
- A verified claim can't be resubmitted: `submitForReview` on a verified claim throws `claim.already_verified_original`.

Add copy:
- `evidence.type_invalid` "Upload a PDF, JPG or PNG file."
- `evidence.too_large` "Each file can be up to 10 MB."
- `evidence.too_many` "You can upload up to 5 files."
- `evidence.required` "Add at least one document first."
- `evidence.not_found` "That file no longer exists."
- `claim.already_in_review` "This claim is already being reviewed."
- `claim.not_in_review` "This claim isn't waiting for review."
- `claim.review_note_invalid` "Add a note of up to 500 characters."

- [ ] **Step 4: Write the failing use-case tests** (`application/evidence.test.ts`, on `createTestDb()` with a real claim, real repositories and an in-memory store in the test)

```ts
it('takes a supplier’s evidence through review and deletes the files once approved', async () => {
  const { deps, ids, stored } = await setup();
  await expect(submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim })).rejects.toMatchObject({ code: 'evidence.required' });
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'invoice.pdf', bytes: PDF });
  expect(stored.has(e.storageKey)).toBe(true);
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'b.pdf', bytes: PDF })).rejects.toMatchObject({ code: 'claim.already_in_review' });
  await expect(removeEvidence(deps, { companyId: ids.indigo, evidenceId: e.id })).rejects.toMatchObject({ code: 'claim.already_in_review' });
  const approved = await approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' });
  expect(approved).toMatchObject({ status: 'verified', reviewedBy: 'admin1' });
  expect(stored.size).toBe(0);
  expect(await deps.evidence.listByClaim(ids.claim)).toEqual([]);
});
it('a rejection deletes the files, keeps the note, and lets the supplier try again', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  expect(await rejectClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1', note: 'Unreadable' })).toMatchObject({ reviewStatus: 'rejected', reviewNote: 'Unreadable' });
  expect(stored.size).toBe(0);
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'b.pdf', bytes: PDF })).resolves.toBeTruthy();
});
it('only the owning supplier and admins can read a file; everyone else sees nothing', async () => {
  const { deps, ids } = await setup();
  const e = await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  expect((await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: false, companyId: ids.indigo } }))?.bytes).toEqual(PDF);
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: true, companyId: null } })).not.toBeNull();
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: false, companyId: ids.denizli } })).toBeNull();
  expect(await readEvidence(deps, { evidenceId: e.id, viewer: { isAdmin: false, companyId: null } })).toBeNull();
});
it('refuses another supplier’s claim, a sixth file, and a second verified original', async () => {
  const { deps, ids } = await setup();
  await expect(addEvidence(deps, { companyId: ids.denizli, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF })).rejects.toMatchObject({ code: 'auth.forbidden' });
  for (let i = 0; i < 5; i++) await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: `${i}.pdf`, bytes: PDF });
  await expect(addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: '6.pdf', bytes: PDF })).rejects.toMatchObject({ code: 'evidence.too_many' });
  await submitClaimForReview(deps, { companyId: ids.indigo, claimId: ids.claim });
  await deps.claims.save(verifyClaim(ids.rivalClaim));
  await expect(approveClaimReview(deps, { claimId: ids.claim, adminUserId: 'admin1' })).rejects.toMatchObject({ code: 'claim.already_verified_original' });
});
it('withdrawing a claim deletes its files', async () => {
  const { deps, ids, stored } = await setup();
  await addEvidence(deps, { companyId: ids.indigo, claimId: ids.claim, fileName: 'a.pdf', bytes: PDF });
  await withdrawClaim(deps, { companyId: ids.indigo, claimId: ids.claim });
  expect(stored.size).toBe(0);
});
```

`setup()` provides `deps`, `stored` (the in-memory store's `Map`) and `ids` (`indigo`, `denizli`, `claim`: Indigo's declared original on a product; `rivalClaim`: Denizli's declared original `Claim` object on the same product, saved).

- [ ] **Step 5: Implement the use cases and storage**

- A failure deleting a stored file is logged with `console.error` and doesn't fail the decision.
- In `addEvidence`, store the bytes first, and delete them again if saving the row fails.
- Only `original`, `declared` claims not in `pending` accept files. `removeEvidence` follows the same rule.
- `readEvidence` returns `null` for a missing id, a non-owner, or missing bytes.
- `approveClaimReview` keeps the existing check for another verified original in the same scope.
- Stores: `createLocalEvidenceStore` writes under `dir` and throws unless the key matches `/^evidence\/[0-9a-zA-Z-]+\/[0-9a-zA-Z-]+$/`; `get` returns `null` on `ENOENT`, and `delete` ignores it. `createR2EvidenceStore` uses the given interface.

Add tests in `evidence-stores.test.ts`:
- local store round trip in a temp folder
- local store refuses `../x`
- local store `get` of a missing key is `null`
- R2 store round trip with a fake bucket

Schema: add `review_status text not null default 'none'`, `review_note text`, `reviewed_by text`, `reviewed_at timestamptz` to `claims`, and a new `claim_evidence` table (`id uuid pk`, `claim_id uuid → claims.id on delete cascade`, `file_name`, `content_type`, `size_bytes integer`, `storage_key`, `created_at`), with an index on `claim_id`.

Run: `pnpm db:generate --name=claim-evidence`.

`withdrawClaimAction` now passes `evidence` and `store` deps. Until Task 7 adds them to the container, build them in the action from `createEvidenceRepository(db)` and `createLocalEvidenceStore(process.env.EVIDENCE_DIR ?? './.data/evidence')`; Task 7 moves this to the container.

- [ ] **Step 6: Verify and commit**

Run the "every task ends with" checks. Expected: all pass.

```bash
git commit -m "feat(claims): evidence review with private file storage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verification pages and admin review

**Files:**
- Create: `src/app/verify/[claim]/{page.tsx,actions.ts,actions.test.ts,upload-evidence-form.tsx}`, `src/app/api/evidence/[id]/route.ts`, `src/app/admin/claims/reject-form.tsx`, `src/modules/discovery/infrastructure/pending-reviews.ts`, `e2e/verification.spec.ts`
- Delete: `src/modules/claims/application/verify-original-claim.ts`, `src/modules/discovery/infrastructure/declared-originals.ts`
- Modify: `src/server/{config.ts,config.test.ts,container.ts,container.test.ts}`, `src/modules/claims/index.ts`, `src/modules/discovery/{index.ts,infrastructure/types.ts,infrastructure/company-page-view.ts,infrastructure/discovery.test.ts}`, `src/app/admin/claims/{page.tsx,actions.ts,actions.test.ts}`, `src/app/m/[company]/{page.tsx,actions.ts}`, `next.config.ts`, `wrangler.jsonc`, `.env.example`, `docs/deploy.md`, `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: the Task 6 use cases.
- Produces:
  - `AppConfig.evidenceDir: string` (from `EVIDENCE_DIR`, default `./.data/evidence`)
  - `Container` gains `evidence: EvidenceRepository`, `evidenceStore: EvidenceStore`
  - from `@/modules/discovery`: `type PendingReview = { claimId: string; scope: ClaimScope; product: { id: string; brand: string; name: string }; company: { slug: string; name: string }; evidence: { id: string; fileName: string; sizeBytes: number }[] }`, `listPendingReviews(db): Promise<PendingReview[]>` (oldest first)
  - `CompanyPageView.garments[]` gains `claimStatus: ClaimStatus`, `reviewStatus: ReviewStatus`

- [ ] **Step 1: Write the failing e2e spec** (`e2e/verification.spec.ts`)

```ts
import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

const pdf = { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 demo') };

test('a supplier submits evidence, an admin approves it, and the badge appears', async ({ page, browser }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill');
  await page.getByTestId('mill-garment').filter({ hasText: 'Printed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await page.getByLabel(/add a document/i).setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await expect(page.getByRole('alert')).toHaveText('Upload a PDF, JPG or PNG file.');
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  const file = page.getByRole('link', { name: 'invoice.pdf' });
  await expect(file).toBeVisible();
  const fileUrl = (await file.getAttribute('href'))!;
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText(/under review/i)).toBeVisible();

  // Anyone else gets a 404 for the file.
  const stranger = await browser.newContext();
  expect((await stranger.request.get(`http://localhost:3100${fileUrl}`)).status()).toBe(404);
  await stranger.close();

  const admin = await (await browser.newContext({ baseURL: 'http://localhost:3100' })).newPage();
  await signIn(admin, 'admin@example.test');
  await admin.goto('/admin/claims');
  const row = admin.getByTestId('pending-review').filter({ hasText: 'LIU-JO' });
  const download = await admin.request.get(`http://localhost:3100${fileUrl}`);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-disposition']).toContain('attachment');
  expect(download.headers()['x-content-type-options']).toBe('nosniff');
  await row.getByRole('button', { name: /^approve$/i }).click();
  await expect(row).toHaveCount(0);
  await admin.goto(`/p/${DEMO.products.liujo}`);
  await expect(admin.getByTestId('original-claim')).toContainText('Verified');
  expect((await admin.request.get(`http://localhost:3100${fileUrl}`)).status()).toBe(404); // deleted once decided
});

test('a rejected supplier sees why and can try again', async ({ page, browser }) => {
  await signIn(page, 'bursa@example.test');
  await page.goto(`/add`);
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html');
  await page.getByRole('button', { name: /fetch/i }).click();
  await page.getByRole('button', { name: /publish 1 products?/i }).click();
  await page.getByTestId('mill-garment').filter({ hasText: 'Washed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  await expect(page.getByRole('link', { name: 'invoice.pdf' })).toBeVisible();
  await page.getByRole('button', { name: /submit for review/i }).click();

  const admin = await (await browser.newContext({ baseURL: 'http://localhost:3100' })).newPage();
  await signIn(admin, 'admin@example.test');
  await admin.goto('/admin/claims');
  const row = admin.getByTestId('pending-review').filter({ hasText: 'Bursa Weave' });
  await row.getByLabel(/reason/i).fill('The invoice is unreadable');
  await row.getByRole('button', { name: /^reject$/i }).click();
  await expect(row).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('The invoice is unreadable')).toBeVisible();
  await expect(page.getByLabel(/add a document/i)).toBeVisible();
});
```

In `e2e/admin.spec.ts`, delete the old "admin verifies a declared original" test.

Run: `pnpm e2e e2e/verification.spec.ts`. Expected: FAIL.

- [ ] **Step 2: Wire the container and config**

- Config: `evidenceDir`.
- Container: on Workers, `env.EVIDENCE` is required (throw a clear error, as for Hyperdrive) and becomes `createR2EvidenceStore`. Elsewhere use `createLocalEvidenceStore(config.evidenceDir)`.
- Add a test in `container.test.ts` for the missing binding.
- `wrangler.jsonc`: `"r2_buckets": [{ "binding": "EVIDENCE", "bucket_name": "xmanufacture-evidence" }]`.
- `.env.example`: `EVIDENCE_DIR=./.data/evidence`. `playwright.config.ts` env: `EVIDENCE_DIR: './.data/e2e-evidence'`, removed at the start of each run alongside `.data/e2e`.
- `docs/deploy.md`: add `pnpm wrangler r2 bucket create xmanufacture-evidence`.
- `next.config.ts`: set `serverActions.bodySizeLimit` to `'11mb'`, placed as `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` shows. Files upload one per action call, so 11 MB covers the 10 MB cap.
- `withdrawClaimAction` uses `evidence` and `evidenceStore` from the container.

- [ ] **Step 3: Build the supplier page and actions**

`/verify/[claim]` page: `requireMill()`, `z.uuid()`, and `notFound()` unless the claim is this company's and `original`. It shows the product, and then:
- **Verified:** "Verified", and nothing to do.
- **Rejected:** the note, as "Rejected: {note}. Add new documents and submit again."
- **Pending:** "Under review", with the file names listed and nothing editable.
- **Otherwise:** the file list (links to `/api/evidence/<id>`, each with a Remove button), `UploadEvidenceForm`, and a "Submit for review" button.
- Help text: "Upload an invoice, order or correspondence with the customer. Cover prices if you like. Files are private and deleted once reviewed."

`UploadEvidenceForm`: a labelled file input "Add a document" (`accept=".pdf,.jpg,.jpeg,.png"`) that submits as soon as a file is chosen, shows pending, and shows errors with `role="alert"`.

Actions in `actions.ts`, each starting with `requireMill()` and `z.uuid()`, using `toActionError` and `revalidatePath`:
- `uploadEvidenceAction(claimId: string, prev: ActionResult | null, form: FormData): Promise<ActionResult>`, which rejects a missing file, and a file over 10 MB before reading it
- `removeEvidenceAction(claimId: string, evidenceId: string): Promise<ActionResult>`
- `submitForReviewAction(claimId: string): Promise<ActionResult>`

Unit tests in `actions.test.ts`, following `src/app/m/[company]/actions.test.ts`: a non-uuid gets the generic error; another supplier's claim gets the `auth.forbidden` copy; `requireMill` rejecting stops everything before the container is read.

Mill page, owner only, for an `original` tile: `reviewStatus === 'pending'` shows the text "Under review"; otherwise `claimStatus === 'declared'` shows a link "Get verified" to `/verify/<claimId>`.

- [ ] **Step 4: Build the download route**

`GET /api/evidence/[id]`: read the viewer through `getViewer()`, validate the uuid, call `readEvidence`, and return 404 with no body for every failure. On success the response headers are `Content-Type: <evidence.contentType>`, `Content-Disposition: attachment; filename="<fileName>"` (escaping quotes), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.

- [ ] **Step 5: Build the admin queue**

`listPendingReviews` returns only `reviewStatus = 'pending'`; add a discovery test covering it (replacing the `listDeclaredOriginals` test).

The admin page lists `data-testid="pending-review"` rows: product link, supplier name, scope, file links, an "Approve" `RowActionButton`, and a `RejectForm` with a "Reason" text input and a "Reject" button. Replace `verifyClaimAction` with `approveReviewAction(claimId)` and `rejectReviewAction(claimId, prev, form)`, each `requireAdmin()` first, passing `viewer.userId` as `adminUserId`. Update `actions.test.ts`.

Delete `verify-original-claim.ts` and remove its export. Rewrite its tests from Task 4 in `claims.test.ts` to use `approveClaimReview` (a mill and a garment maker can both be approved; a second mill can't). Empty state: "Nothing to review."

- [ ] **Step 6: Verify and commit**

Run the "every task ends with" checks. Expected: all pass.

```bash
git commit -m "feat(app): suppliers submit evidence and admins review it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Search counting and admin stats

**Files:**
- Create: `src/modules/catalog/infrastructure/search-log.ts`, `src/app/_lib/visitor-hash.ts`, `src/app/_lib/visitor-hash.test.ts`, `src/modules/discovery/infrastructure/platform-stats.ts`, `src/app/admin/stats/page.tsx`, `drizzle/0015_search-events.sql` (generated)
- Modify: `src/modules/catalog/infrastructure/schema.ts`, `src/modules/catalog/index.ts`, `src/modules/discovery/{index.ts,infrastructure/types.ts,infrastructure/discovery.test.ts}`, `src/server/container.ts`, `src/app/actions.ts`, `src/app/actions.test.ts`, `src/app/_components/chrome/site-nav.tsx`
- Test: `e2e/admin.spec.ts`

**Interfaces:**
- Produces, from `@/modules/catalog`: `type SearchLog = { record(input: { matched: boolean; visitorHash: string | null }): Promise<void> }`, `createSearchLog(db: Db): SearchLog`.
- Produces: `visitorHash(ip: string | null, secret: string, now: Date): string | null`, and `Container.searches: SearchLog`.
- Produces, from `@/modules/discovery`: `type PlatformStats = { suppliers: number; taggedProducts: number; searches: number; matchedSearches: number; distinctSearchers: number }`, `getPlatformStats(db): Promise<PlatformStats>`.

- [ ] **Step 1: Write the failing tests**

```ts
// visitor-hash.test.ts
it('hashes per day, is keyed by the secret, and never contains the address', () => {
  const day1 = new Date('2026-10-30T10:00:00Z'), later = new Date('2026-10-30T23:00:00Z'), day2 = new Date('2026-10-31T01:00:00Z');
  const h = visitorHash('203.0.113.9', 's', day1)!;
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(h).not.toContain('203.0.113.9');
  expect(visitorHash('203.0.113.9', 's', later)).toBe(h);
  expect(visitorHash('203.0.113.9', 's', day2)).not.toBe(h);
  expect(visitorHash('203.0.113.9', 'other', day1)).not.toBe(h);
  expect(visitorHash(null, 's', day1)).toBeNull();
});

// discovery.test.ts
it('counts suppliers, tagged products, searches and distinct searchers', async () => {
  const own = await createTestDb();
  await seedDemo(own);
  const log = createSearchLog(own);
  await log.record({ matched: true, visitorHash: 'a' });
  await log.record({ matched: false, visitorHash: 'a' });
  await log.record({ matched: true, visitorHash: 'b' });
  await log.record({ matched: false, visitorHash: null });
  expect(await getPlatformStats(own)).toEqual({ suppliers: 4, taggedProducts: 3, searches: 4, matchedSearches: 2, distinctSearchers: 2 });
});
```

In `src/app/actions.test.ts`, add `searches` to the fake container and mock `next/headers`:

```ts
it('counts a matched and an unmatched search, but not a blank one', async () => { /* matched → record({ matched: true, … }); miss → matched: false; blank → no call */ });
it('still finds the product when the search log fails', async () => { /* record rejects → the redirect still happens, console.error called once (silenced) */ });
```

- [ ] **Step 2: Run them and check they fail**

Run: `pnpm test src/app/_lib/visitor-hash src/modules/discovery src/app/actions`. Expected: FAIL.

- [ ] **Step 3: Implement**

- `search_events` table in catalog's schema: `id uuid pk`, `matched boolean not null`, `visitor_hash text`, `created_at timestamptz not null default now()`.
- Run: `pnpm db:generate --name=search-events`.
- `visitorHash`: SHA-256 hex of `${YYYY-MM-DD in UTC}:${ip}:${secret}`, using `node:crypto`.
- `findGarmentAction`: read the IP from `cf-connecting-ip`, then the first `x-forwarded-for` hop, through `headers()`. Record once the lookup is done and before the redirect, in a try/catch that logs with `console.error`. Blank and over-long input return before any lookup or record, as now.
- `getPlatformStats`: `suppliers` = companies; `taggedProducts` = distinct `claims.product_id`; `distinctSearchers` = distinct non-null `visitor_hash`, which counts a returning visitor once per day.

- [ ] **Step 4: Build the stats page**

`/admin/stats`: `requireAdmin()`, with the heading "Stats" and one row per target:

| Row | Value | Target text |
|---|---|---|
| Suppliers | `suppliers` | `Target: 20–30` |
| Products | `taggedProducts` | `Target: 200–300` |
| Searchers | `distinctSearchers` | `Target: 10–20` |
| Searches | `searches` (with `matchedSearches` found) | none |

Add a "Stats" link next to "Admin" in the nav, for admins only.

- [ ] **Step 5: Add the e2e test** (`e2e/admin.spec.ts`)

```ts
test('an admin sees the search it just ran counted', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/stats');
  const before = Number(await page.getByTestId('stat-searches').textContent());
  await page.goto('/');
  await page.getByPlaceholder(/paste a product link/i).fill('https://example.com/counted');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page.getByText(/no supplier has tagged/i)).toBeVisible();
  await page.goto('/admin/stats');
  await expect(page.getByTestId('stat-searches')).toHaveText(String(before + 1));
});
test('non-admins can’t see stats', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/admin/stats');
  await expect(page).toHaveURL('http://localhost:3100/');
});
```

- [ ] **Step 6: Verify the whole phase and commit**

Run the "every task ends with" checks. Expected: all pass.

Then check the Workers build with local env files out of the way:

```bash
mv .env.local /tmp/xmanufacture.env.local; pnpm exec opennextjs-cloudflare build; mv /tmp/xmanufacture.env.local .env.local
```

Expected: the build succeeds, and `.env.local` is back in place.

```bash
git commit -m "feat: count searches and show progress against the launch targets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Later plans (not in this one)

- **Buyer accounts and ratings:** sign-up for buyers, customers rating their experience with a supplier, and suppliers' current listings for members.
- **Payments:** buyer subscription, paid ranking among equivalents, and the paid verified badge, which plugs into the evidence flow from Task 6.
- **Other industries and languages:** more company kinds, and Turkish if needed for launch.
