# Manufacturer Registration, Review and Product Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After this plan:
- A company registers as a manufacturer with legal and production details for its country, plus documents.
- It gets free third-party checks.
- An admin approves, rejects, edits or asks for more information before the company goes public.
- One account can hold the searcher, manufacturer and admin modes and switch between them.
- Every claimed product says whether the company made the whole product or one part of it. It uses standard types: HS codes, fibre codes with Latin names, and fabric terms in sector language.

**Architecture:**
- Registration, documents, checks and review live in the `supplier` module. The company is the aggregate under review, the same way `claims` reviews an original claim.
- Parts, fibres, fabric terms and product types are pure data in `src/shared/domain/taxonomy/`, so the catalog, supplier and claims domains can all use them.
- The mode is a cookie that only affects display, resolved in `src/server/`. Authorization keeps checking the real roles.

**Tech Stack:** Next.js 16 App Router with server actions; Drizzle on Postgres (PGlite locally and in tests); Better Auth magic link; Vitest; Playwright; Cloudflare Workers with R2 for documents; Resend.

**Spec:** `docs/superpowers/specs/2026-11-07-manufacturer-registration-design.md`. It holds the decisions, the per-country fields, documents and checks, and the taxonomy tables. The executor reads it alongside this plan. Its tables are the source of every data value referred to here as "spec §N".

## Global Constraints

**Framework and architecture**
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code. AGENTS.md warns that this version differs from your training data.
- Files under `src/modules/*/domain/**` import nothing from Next, React, Drizzle, Better Auth, other modules, `@/server` or `@/app`. They may import `@/shared/**`.
- Other code reaches a module only through its `index.ts`. The exception is `infrastructure/*schema.ts`.
- `pnpm lint` enforces both rules.

**Errors and copy**
- Errors are `DomainError` codes. Every new code gets the English and Turkish sentence from the Appendix in `src/app/_lib/error-messages.ts`; `action-result.test.ts` fails when one is missing.
- New UI copy goes in `defineMessages({ en, tr })` next to its page. Both languages ship together.

**Identity**
- The company and user ids always come from `requireViewer` / `requireMill` / `requireAdmin`, never from form input.

**Schema changes**
- Edit `src/modules/*/infrastructure/*schema.ts`, then run `pnpm db:generate --name <name>`. Migrations continue from `0016`.
- Read the generated SQL every time.

**Uploads**
- PDF, JPG or PNG, with the type sniffed from the bytes, up to 10 MB each.
- They go in the private store: `container.evidenceStore`, which is the R2 `EVIDENCE` bucket on Workers and `EVIDENCE_DIR` locally.
- They are served only to the owner and admins, with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.

**Outbound registry calls**
- Each call uses `AbortSignal.timeout(8000)`.
- A call never throws to its caller; any failure becomes outcome `unknown`.
- A call sends only the identifier or name being checked.

**General**
- Add no new npm dependencies and no new environment variables.
- Tests follow the existing style: Vitest `it(...)`, one fresh `createTestDb()` per test that writes, and PGlite.
- Every task ends with its own tests passing. The last task of each part also runs `pnpm test && pnpm lint && pnpm typecheck && pnpm e2e`.

## Review Focus

1. **A forged mode cookie.** A non-admin sets `xb_mode=admin` by hand. Expected: no admin links appear, and `/admin/*` still redirects home. The mode never authorizes anything. Pinned in Task A1 (`resolveMode`) and Task A2 (e2e).
2. **An admin reviewing their own company.** An admin who owns a company approves, rejects, asks for changes on, or edits their own registration. Expected: refused with `review.own_company`. Pinned in Task D1.
3. **An unapproved company leaking into public views.** A draft, submitted or rejected company's claims show up on product pages, in tile counts, in "recently tagged", in search matches, the sitemap or stats, or its company or article page opens for visitors. Expected: none of that happens, while the owner and admins still see the company page. Pinned in Task B5.
4. **Turkish tax numbers typed loosely.** `123 456 7890`, `123-456-7890`, or an 11-digit TCKN from a sole proprietor. Expected: normalized and checksummed, never refused for formatting. Pinned in Task B1.
5. **A registry that is down, slow or returns junk.** VIES answers `MS_UNAVAILABLE`, a 500, a timeout, or a body that isn't JSON. Expected: the check is stored as `unknown`, and submission and the admin page still work. Pinned in Task C2.

## File map

| Area | Create | Modify |
|---|---|---|
| Roles | `src/server/modes.ts`, `src/app/_actions/switch-mode.ts`, `src/app/_components/chrome/mode-switcher.tsx` | `src/server/viewer.ts`, `site-nav.tsx`, chrome `messages.ts`, onboarding page and action |
| Registration | `supplier/domain/{legal-identifiers,registration,company-document,checks}.ts`, `supplier/application/{registration,company-documents,run-checks,review-registration}.ts`, `supplier/infrastructure/registry-checkers.ts`, `src/shared/domain/uploaded-file.ts`, `src/app/[lang]/m/[company]/registration/*`, `src/app/api/company-documents/[id]/route.ts` | `supplier/{domain/company.ts,domain/repositories.ts,infrastructure/schema.ts,infrastructure/drizzle-repositories.ts,index.ts}`, `claims/domain/evidence.ts`, `src/server/container.ts`, discovery read models, sitemap, search action |
| Admin | `discovery/infrastructure/registration-review.ts`, `src/app/[lang]/admin/manufacturers/**` | nav, `seed-demo.ts`, `demo-ids.ts`, `identity` (`findUserEmail`) |
| Taxonomy | `src/shared/domain/fold.ts`, `src/shared/domain/taxonomy/{parts,fibres,product-types,fabric,index}.ts` | `supplier/domain/article.ts`, `catalog/domain/product.ts`, `claims/domain/claim.ts`, article, product and add pages |

## Execution order

`A1 → A2` can run alongside `E1`. Once E1 is done, two lines run in parallel:
- `B1 → B2 → B3 → B4 → B5 → C1 → C2 → C3 → D1 → D2`
- `E2 → E3 → E4`

E4 touches the onboarding action and page, which B4 also changes, and `ProductPageView`, which B5's tests read. Run E4 after B5.

---

## Part A: Roles and switching between them

### Task A1: Resolve the viewer's modes

**Files:**
- Create: `src/server/modes.ts`
- Create: `src/server/modes.test.ts`
- Modify: `src/server/viewer.ts`

**Interfaces:**
- Produces, in `src/server/modes.ts`:
  - `type Mode = 'search' | 'manufacturer' | 'admin'`
  - `const MODE_COOKIE = 'xb_mode'`
  - `availableModes(v: { isAdmin: boolean }): Mode[]`
  - `resolveMode(v: { isAdmin: boolean; hasCompany: boolean }, cookie: string | undefined): { mode: Mode; chosen: boolean }`
  - `modeHome(mode: Mode, companySlug: string | null): string`. The admin home is `'/admin/claims'` until Task D2 changes it.
  - `onboardingRedirect(v: { company: { slug: string } | null; mode: Mode; modeChosen: boolean; isAdmin: boolean }): string | null`
- `Viewer` gains `modes: Mode[]`, `mode: Mode` and `modeChosen: boolean`.

- [ ] **Step 1: Write the failing test** in `src/server/modes.test.ts`

```ts
import { expect, it } from 'vitest';
import { availableModes, modeHome, onboardingRedirect, resolveMode } from './modes';

it('every signed-in user can search and register; only admins get admin', () => {
  expect(availableModes({ isAdmin: false })).toEqual(['search', 'manufacturer']);
  expect(availableModes({ isAdmin: true })).toEqual(['search', 'manufacturer', 'admin']);
});

it.each([
  [{ isAdmin: false, hasCompany: true }, undefined, { mode: 'manufacturer', chosen: false }],
  [{ isAdmin: true, hasCompany: false }, undefined, { mode: 'admin', chosen: false }],
  [{ isAdmin: false, hasCompany: false }, undefined, { mode: 'search', chosen: false }],
  [{ isAdmin: true, hasCompany: true }, 'search', { mode: 'search', chosen: true }],
  [{ isAdmin: false, hasCompany: true }, 'admin', { mode: 'manufacturer', chosen: false }], // forged: not held, ignored
  [{ isAdmin: false, hasCompany: false }, 'garbage', { mode: 'search', chosen: false }],
] as const)('resolveMode(%j, %s)', (v, cookie, expected) => expect(resolveMode(v, cookie)).toEqual(expected));

it('each mode has a home', () => {
  expect(modeHome('search', null)).toBe('/');
  expect(modeHome('manufacturer', 'indigo-mill')).toBe('/m/indigo-mill');
  expect(modeHome('manufacturer', null)).toBe('/onboarding');
  expect(modeHome('admin', null)).toBe('/admin/claims');
});

it.each([
  [{ company: { slug: 'indigo-mill' }, mode: 'manufacturer', modeChosen: false, isAdmin: false }, '/add'],
  [{ company: { slug: 'indigo-mill' }, mode: 'search', modeChosen: true, isAdmin: false }, '/'],
  [{ company: null, mode: 'search', modeChosen: true, isAdmin: false }, '/'],
  [{ company: null, mode: 'admin', modeChosen: false, isAdmin: true }, '/admin/claims'], // an admin is here to review, unless they pick manufacturer
  [{ company: null, mode: 'manufacturer', modeChosen: true, isAdmin: true }, null], // an admin registering a company
  [{ company: null, mode: 'search', modeChosen: false, isAdmin: false }, null], // a new user sees the choice and the form
] as const)('onboardingRedirect(%j) is %s', (v, expected) => expect(onboardingRedirect(v)).toBe(expected));
```

- [ ] **Step 2: Run the test to see it fail.** Run `pnpm test -- src/server/modes.test.ts`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `src/server/modes.ts`.**
  - `resolveMode`: return the cookie when `availableModes(v)` contains it. Otherwise return `manufacturer` when `hasCompany`, then `admin` when `isAdmin`, otherwise `search`.
  - `onboardingRedirect`:
    - With a company, return `/add` in manufacturer mode and `modeHome(mode, slug)` in any other mode.
    - Without one, return `modeHome(mode, null)` when `modeChosen && mode !== 'manufacturer'`.
    - When `!modeChosen && isAdmin`, return `modeHome('admin', null)`.
    - Otherwise return `null`.

- [ ] **Step 4: Wire it into `getViewer`** in `src/server/viewer.ts`.
  - Read `(await cookies()).get(MODE_COOKIE)?.value`, using `cookies` from `next/headers`.
  - Fill `modes`, `mode` and `modeChosen` with `availableModes` and `resolveMode`.
  - `requireAdmin` and `requireMill` keep checking `isAdmin` and `company`. They never look at `mode`.

- [ ] **Step 5: Run the test to see it pass.** Run `pnpm test -- src/server/modes.test.ts && pnpm typecheck`. Expected: PASS.

- [ ] **Step 6: Commit.**
```bash
git add src/server/modes.ts src/server/modes.test.ts src/server/viewer.ts
git commit -m "feat(roles): resolve searcher, manufacturer and admin modes per viewer"
```

### Task A2: Mode switcher, navigation per mode, and the sign-in landing

**Files:**
- Create: `src/app/_actions/switch-mode.ts`
- Create: `src/app/_components/chrome/mode-switcher.tsx`
- Create: `e2e/modes.spec.ts`
- Modify: `src/app/_components/chrome/site-nav.tsx`
- Modify: `src/app/_components/chrome/messages.ts`
- Modify: `src/app/[lang]/onboarding/page.tsx`
- Modify: `src/app/[lang]/onboarding/messages.ts`
- Modify: `playwright.config.ts`, setting `ADMIN_EMAILS: 'admin@example.test,admin-maker@example.test'`

**Interfaces:**
- Consumes everything Task A1 produces.
- Produces `switchModeAction(mode: Mode): Promise<void>`, a server action. It:
  1. Calls `requireViewer()`.
  2. If `mode` is not in `viewer.modes`, leaves the cookie as it is.
  3. Otherwise sets `MODE_COOKIE` with `{ httpOnly: true, sameSite: 'lax', secure: config.baseUrl.startsWith('https:'), path: '/', maxAge: 31_536_000 }`.
  4. Calls `redirect(localePath(await actionLang(), modeHome(mode, viewer.company?.slug ?? null)))`.

- [ ] **Step 1: Write the failing e2e test** in `e2e/modes.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('a manufacturer switches to search and back', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  const modes = page.getByRole('group', { name: /mode/i });
  await expect(modes.getByRole('button')).toHaveText(['Search', 'Manufacturer']);
  await modes.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Add products' })).toHaveCount(0);
  await modes.getByRole('button', { name: 'Manufacturer' }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill$/);
});

test('a forged admin cookie grants nothing', async ({ page, context, baseURL }) => {
  await signIn(page, 'mill@example.test');
  await context.addCookies([{ name: 'xb_mode', value: 'admin', url: baseURL! }]);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Claims' })).toHaveCount(0);
  await page.goto('/admin/claims');
  await expect(page).toHaveURL(/\/$/);
});

test('an admin can also register a company', async ({ page }) => {
  await signIn(page, 'admin-maker@example.test');
  await expect(page).toHaveURL(/\/admin\/claims$/);
  await page.getByRole('group', { name: /mode/i }).getByRole('button', { name: 'Manufacturer' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel(/company name/i)).toBeVisible();
});

test('a searcher picks search once and lands there next time', async ({ page }) => {
  await signIn(page, 'just-looking@example.test');
  await page.getByRole('button', { name: /search manufacturers/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page, 'just-looking@example.test');
  await expect(page).toHaveURL(/\/$/);
});
```

- [ ] **Step 2: Run it to see it fail.** Run `pnpm e2e -- e2e/modes.spec.ts`. Expected: FAIL, because there is no mode group.

- [ ] **Step 3: Implement the switcher and the navigation for each mode.**
  - **`ModeSwitcher`:**
    - Renders `<div role="group" aria-label={t.mode}>`.
    - It holds one `<form action={switchModeAction.bind(null, m)}>` per mode in `viewer.modes`, each with a submit button.
    - The current mode's button gets `aria-current="true"`.
    - Labels: EN Search / Manufacturer / Admin; TR Arama / Üretici / Yönetici.
  - **`SiteNav`** renders `ModeSwitcher` for a signed-in viewer and chooses its links by `viewer.mode`:
    - `search`: Brands.
    - `manufacturer`: My company and Add products when there is a company; "Register your company" / "Firmanızı kaydedin", linking to `/onboarding`, when there isn't.
    - `admin`: Claims and Stats.
  - Sign out shows in every mode.

- [ ] **Step 4: Update the onboarding page.**
  - Replace both redirects with `const to = onboardingRedirect(viewer); if (to) redirect(href(to));`.
  - Above the form, add a line with copy EN "Only searching?" / TR "Sadece arama mı yapacaksınız?".
  - Next to it, add `<form action={switchModeAction.bind(null, 'search')}>` with a button: EN "Search manufacturers" / TR "Üretici arayın".

- [ ] **Step 5: Run the tests to see them pass.** Run `pnpm e2e -- e2e/modes.spec.ts e2e/onboarding.spec.ts e2e/admin.spec.ts`. Expected: PASS.

- [ ] **Step 6: Run the full suite and commit.**
```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
git add src/app/_actions/switch-mode.ts src/app/_components/chrome src/app/[lang]/onboarding e2e/modes.spec.ts playwright.config.ts
git commit -m "feat(roles): switch between search, manufacturer and admin from the header"
```

---

## Part B: Registration with validation data

### Task B1: Legal identifier rules per country

**Files:**
- Create: `src/modules/supplier/domain/legal-identifiers.ts`
- Create: `src/modules/supplier/domain/legal-identifiers.test.ts`
- Modify: `src/app/_lib/error-messages.ts`, adding `registration.tax_id_invalid`, `registration.lei_invalid` and `registration.nace_invalid`

**Interfaces:**
- Produces:
  - `normalizeTaxId(country: string, raw: string): string`. It throws `registration.tax_id_invalid`.
  - `isValidVkn(v: string): boolean`
  - `isValidTckn(v: string): boolean`
  - `isValidLei(v: string): boolean`
  - `normalizeNace(raw: string): string`. It throws `registration.nace_invalid`.
  - `isManufacturingNace(code: string): boolean`
  - `const VIES_MEMBER_STATE: Readonly<Record<string, string>>`. It maps an ISO country to the VIES member-state code for the 27 EU countries, with `GR` mapping to `EL`.
  - `taxIdLabel(country: string): 'vkn' | 'vat' | 'trn' | 'company_number' | 'tax_id'`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { isManufacturingNace, isValidLei, normalizeNace, normalizeTaxId } from './legal-identifiers';

it.each([
  ['TR', '123 456 7890', '1234567890'],
  ['TR', '484-084-7211', '4840847211'],
  ['TR', '10000000146', '10000000146'], // TCKN: a sole proprietor's tax number
  ['DE', 'DE 123-456-789', 'DE123456789'],
  ['DE', '123456789', 'DE123456789'],
  ['GR', '123456789', 'EL123456789'],
  ['GR', 'EL123456789', 'EL123456789'],
  ['NL', 'nl004495445b01', 'NL004495445B01'],
  ['GB', 'GB123456789', 'GB123456789'],
  ['SA', '300000000000003', '300000000000003'],
  ['AE', '100123456700003', '100123456700003'],
  ['US', '12-3456789', '123456789'],
])('normalizeTaxId(%s, %s) → %s', (country, raw, expected) => expect(normalizeTaxId(country, raw)).toBe(expected));

it.each([
  ['TR', '1234567891'], ['TR', '10000000147'], ['TR', '123'], ['FR', '12345'], ['SA', '400000000000003'], ['DE', ''],
])('normalizeTaxId(%s, %s) throws', (country, raw) =>
  expect(() => normalizeTaxId(country, raw)).toThrow(expect.objectContaining({ code: 'registration.tax_id_invalid' })));

it('checks the LEI checksum (ISO 17442, mod 97)', () => {
  expect(isValidLei('5493001KJTIIGC8Y1R12')).toBe(true);
  expect(isValidLei('5493001KJTIIGC8Y1R13')).toBe(false);
});

it.each([
  ['13.20', '13.20'], ['1320', '13.20'], ['13.20.01', '13.20.01'], ['132001', '13.20.01'], ['13', '13'], ['13.2', '13.2'],
])('normalizeNace(%s) → %s', (raw, expected) => expect(normalizeNace(raw)).toBe(expected));

it.each(['abc', '00', '1', '1234567'])('normalizeNace(%s) throws', (raw) =>
  expect(() => normalizeNace(raw)).toThrow(expect.objectContaining({ code: 'registration.nace_invalid' })));

it('manufacturing is NACE section C, divisions 10–33', () => {
  expect(['10.11', '13.20.01', '33'].map(isManufacturingNace)).toEqual([true, true, true]);
  expect(['09.10', '46.41'].map(isManufacturingNace)).toEqual([false, false]);
});
```

- [ ] **Step 2: Run it to see it fail.** Run `pnpm test -- src/modules/supplier/domain/legal-identifiers.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** First strip `[\s.\-/]` and upper-case the input. Then:
  - **VKN** (spec §5, python-stdnum), for 10 digits `v`. Use the same number `i` for the digit's position and its weight:
    ```
    s = 0
    for i in 1..9:
        d  = digit v[9 - i]        # i = 1 is the 9th digit
        c1 = (d + i) % 10
        if c1 != 0:
            c2 = (c1 * 2^i) % 9
            if c2 == 0: c2 = 9
            s += c2
    valid when (10 - s % 10) % 10 == v[9]
    ```
  - **TCKN**, for 11 digits:
    - The first digit is not 0.
    - `d10 = ((d1+d3+d5+d7+d9)*7 − (d2+d4+d6+d8))` mod 10, kept non-negative.
    - `d11 = (d1+…+d10) mod 10`.
  - **LEI:** 20 characters `[A-Z0-9]`. Map each letter to its value (A=10 … Z=35), read the result as one number, and check that it equals 1 mod 97. Compute the mod digit by digit.
  - **EU VAT:** strip `VIES_MEMBER_STATE[country]`, or the country code, when it leads the number. Test the rest against the regex for that country below, and return `prefix + number`.
    ```
    AT ^U\d{8}$  BE ^[01]\d{9}$  BG ^\d{9,10}$  CY ^\d{8}[A-Z]$  CZ ^\d{8,10}$  DE ^\d{9}$  DK ^\d{8}$  EE ^\d{9}$
    GR ^\d{9}$  ES ^[A-Z0-9]\d{7}[A-Z0-9]$  FI ^\d{8}$  FR ^[A-HJ-NP-Z0-9]{2}\d{9}$  HR ^\d{11}$  HU ^\d{8}$
    IE ^(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$  IT ^\d{11}$  LT ^(\d{9}|\d{12})$  LU ^\d{8}$  LV ^\d{11}$  MT ^\d{8}$
    NL ^\d{9}B\d{2}$  PL ^\d{10}$  PT ^\d{9}$  RO ^\d{2,10}$  SE ^\d{12}$  SI ^\d{8}$  SK ^\d{10}$
    ```
  - **Other countries:**
    - `GB`: strip `GB`, match `^(\d{9}|\d{12})$`, and return `GB` + the number.
    - `CH`: strip `CHE` and a trailing `MWST`, `TVA` or `IVA`, match `^\d{9}$`, and return `CHE` + the number.
    - `SA`: `^3\d{13}3$`.
    - `AE`: `^\d{15}$`.
    - `IL` and `EG`: `^\d{9}$`.
    - Any other country: `^[A-Z0-9]{5,20}$`.
  - **NACE:** remove the dots and require 2, 3, 4 or 6 digits, with the division (the first 2 digits) between 01 and 99. Re-insert dots as `dd`, `dd.d`, `dd.dd` or `dd.dd.dd`.
  - **`isManufacturingNace`:** the division is between 10 and 33.
  - **`taxIdLabel`:**
    - `TR` → `vkn`, labelled EN "Tax number (VKN or TCKN)" / TR "Vergi kimlik no (VKN veya TCKN)".
    - The EU countries, `GB`, `CH` and `SA` → `vat`: "VAT number" / "KDV numarası".
    - `AE` → `trn`: "Tax registration number (TRN)" / "Vergi kayıt no (TRN)".
    - `IL` → `company_number`: "Company number" / "Şirket numarası".
    - Any other country → `tax_id`: "Tax ID" / "Vergi numarası".

- [ ] **Step 4: Run the test to see it pass.** Expected: PASS.

- [ ] **Step 5: Commit.** Run `git commit -m "feat(registration): tax number, LEI and NACE rules per country"`.

### Task B2: Company status, registration details and review events

**Files:**
- Create: `src/modules/supplier/domain/registration.ts`
- Create: `src/modules/supplier/domain/registration.test.ts`
- Modify: `src/modules/supplier/domain/company.ts`, where `Company` gains `status`
- Modify: `src/modules/supplier/domain/repositories.ts`
- Modify: `src/modules/supplier/infrastructure/schema.ts`
- Modify: `src/modules/supplier/infrastructure/drizzle-repositories.ts`
- Modify: `src/modules/supplier/index.ts`
- Modify: `src/modules/supplier/application/supplier.test.ts`
- Modify: `src/server/seed-demo.ts`, saving the demo companies with `status: 'approved'`
- Modify: `src/server/container.ts`
- Modify: `src/app/_lib/error-messages.ts`
- Generate: `drizzle/0016_company-registration.sql`, then edit it by hand

**Interfaces:**
- Consumes everything Task B1 produces.
- Produces, in `registration.ts`:
  - `type CompanyStatus = 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected'`. It goes on `Company.status`, and `createCompany` sets `'draft'`.
  - `type DocumentKind = 'tax_certificate' | 'registry_extract' | 'signature_circular' | 'industry_registry' | 'capacity_report' | 'certificate' | 'facility_photo' | 'other'`
  - `requiredDocuments(country: string): readonly { key: string; anyOf: readonly DocumentKind[] }[]`, with the groups from spec §4. The keys are `tax_certificate`, `registry_extract` and `manufacturing_proof`.
  - `type CertificationScheme`, holding the 12 schemes in spec §3 as `oeko_tex_100 | gots | ocs | grs | rcs | bluesign | iso_9001 | iso_14001 | amfori_bsci | smeta | wrap | other`
  - `type EmployeeBand = '1-9' | '10-49' | '50-249' | '250+'`
  - `type Registration`, a readonly object with these fields:
    ```
    companyId: string
    legalName, taxId, taxOffice, registryNumber, mersisNumber,
      industryRegistryNumber, lei, registeredAddress, facilityAddress,
      monthlyCapacity, openSupplyHubId: string | null
    employees: EmployeeBand | null
    naceCodes: readonly string[]
    certifications: readonly { scheme: CertificationScheme; number: string; validUntil: string | null }[]
    updatedAt: Date
    ```
  - `type RegistrationInput`, which has the same fields as optional `string | null`, except `naceCodes?: string[]` and `certifications?: { scheme: string; number: string; validUntil?: string | null }[]`.
  - `normalizeRegistration(country: string, companyId: string, input: RegistrationInput, now?: Date): Registration`
  - `missingForSubmit(country: string, reg: Registration | null, documentKinds: readonly DocumentKind[]): string[]`
  - `type ReviewAction = 'submitted' | 'approved' | 'rejected' | 'changes_requested' | 'edited'`
  - `type ReviewEvent`, readonly: `{ id; companyId; actorUserId: string; action: ReviewAction; note: string | null; changes: Record<string, [unknown, unknown]> | null; createdAt: Date }`
  - `assertOwnerCanEdit(c: Company): void`
  - `submitCompany(c: Company, missing: readonly string[], now?: Date): { company: Company; event: ReviewEvent }`
  - `approveCompany(c, adminUserId, now?)`, `rejectCompany(c, adminUserId, note, now?)` and `requestCompanyChanges(c, adminUserId, note, now?)`, all returning the same `{ company, event }` shape
  - `diffRegistration(before: Registration | null, after: Registration): Record<string, [unknown, unknown]>`
- Repositories:
  - `RegistrationRepository { find(companyId): Promise<Registration | null>; save(r): Promise<void>; taxIdTaken(country, taxId, exceptCompanyId): Promise<boolean> }`
  - `ReviewEventRepository { add(e): Promise<void>; listByCompany(companyId): Promise<ReviewEvent[]> }`, listed oldest first
  - `createSupplierRepositories(db)` also returns `registrations` and `reviewEvents`, and the container exposes both.

- [ ] **Step 1: Write the failing domain test** in `registration.test.ts`

```ts
import { expect, it } from 'vitest';
import { createCompany, type Company, type CompanyStatus } from './company';
import { approveCompany, missingForSubmit, normalizeRegistration, rejectCompany, requestCompanyChanges, submitCompany } from './registration';

const TR = {
  legalName: 'Aksu Denim Tekstil San. ve Tic. A.Ş.', taxId: '123 456 7890', taxOffice: 'Esenler', registryNumber: '123456',
  mersisNumber: '0123456789000015', industryRegistryNumber: '34-123456', lei: null,
  registeredAddress: 'Atışalanı Cd. 1, Esenler, İstanbul', facilityAddress: 'OSB 5. Cd. 12, Çorlu, Tekirdağ',
  naceCodes: ['13.20.01', '1330'], employees: '50-249', monthlyCapacity: '300,000 m',
  certifications: [{ scheme: 'oeko_tex_100', number: '21.HTR.12345', validUntil: '2027-06-30' }], openSupplyHubId: null,
};
const ALL_TR_DOCS = ['tax_certificate', 'registry_extract', 'capacity_report'] as const;
const fresh = (owner = 'u1'): Company =>
  createCompany({ name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: owner, contact: { email: 'a@aksu.test' }, kind: 'fabric_mill' });
const at = (status: CompanyStatus, owner = 'u1'): Company => ({ ...fresh(owner), status });

it('a new company starts as a draft', () => expect(fresh().status).toBe('draft'));

it('normalizes a Turkish registration', () => {
  expect(normalizeRegistration('TR', 'c1', TR)).toMatchObject({ taxId: '1234567890', naceCodes: ['13.20.01', '13.30'], employees: '50-249' });
});

it('saves half-filled drafts', () => {
  expect(normalizeRegistration('TR', 'c1', { legalName: 'Aksu' })).toMatchObject({ legalName: 'Aksu', taxId: null, naceCodes: [] });
});

it.each([
  [{ legalName: 'A' }, 'registration.legal_name_invalid'],
  [{ taxId: '1234567891' }, 'registration.tax_id_invalid'],
  [{ mersisNumber: '123' }, 'registration.mersis_invalid'],
  [{ lei: '5493001KJTIIGC8Y1R13' }, 'registration.lei_invalid'],
  [{ naceCodes: ['x'] }, 'registration.nace_invalid'],
  [{ employees: 'lots' }, 'registration.employees_invalid'],
  [{ facilityAddress: 'x'.repeat(301) }, 'registration.text_too_long'],
  [{ certifications: [{ scheme: 'gots', number: '', validUntil: null }] }, 'registration.certification_invalid'],
  [{ certifications: [{ scheme: 'gots', number: 'CU123', validUntil: '2027-02-30' }] }, 'registration.certification_invalid'],
])('rejects %j', (patch, code) =>
  expect(() => normalizeRegistration('TR', 'c1', { ...TR, ...patch })).toThrow(expect.objectContaining({ code })));

it('lists what is missing before a submit, in a fixed order', () => {
  expect(missingForSubmit('TR', null, [])).toEqual([
    'legal_name', 'tax_id', 'registry_number', 'registered_address', 'facility_address', 'nace_manufacturing',
    'doc:tax_certificate', 'doc:registry_extract', 'doc:manufacturing_proof',
  ]);
  const reg = normalizeRegistration('TR', 'c1', TR);
  expect(missingForSubmit('TR', reg, ALL_TR_DOCS)).toEqual([]);
  expect(missingForSubmit('TR', { ...reg, naceCodes: ['46.41'] }, ALL_TR_DOCS)).toEqual(['nace_manufacturing']);
  expect(missingForSubmit('DE', normalizeRegistration('DE', 'c1', { ...TR, taxId: 'DE123456789', mersisNumber: null }), ['registry_extract', 'facility_photo'])).toEqual([]);
});

it('walks the review states', () => {
  expect(submitCompany(at('draft'), [])).toMatchObject({ company: { status: 'submitted' }, event: { action: 'submitted', actorUserId: 'u1' } });
  expect(submitCompany(at('changes_requested'), []).company.status).toBe('submitted');
  expect(approveCompany(at('submitted'), 'admin').company.status).toBe('approved');
  expect(requestCompanyChanges(at('submitted'), 'admin', ' Upload the capacity report ').event).toMatchObject({ action: 'changes_requested', note: 'Upload the capacity report' });
  expect(rejectCompany(at('approved'), 'admin', 'A trader, not a manufacturer').company.status).toBe('rejected');
});

it.each([
  [() => submitCompany(at('draft'), ['tax_id']), 'registration.incomplete'],
  [() => submitCompany(at('submitted'), []), 'registration.locked'],
  [() => approveCompany(at('draft'), 'admin'), 'registration.not_submitted'],
  [() => requestCompanyChanges(at('approved'), 'admin', 'x'), 'registration.not_submitted'],
  [() => rejectCompany(at('draft'), 'admin', 'x'), 'registration.not_submitted'],
  [() => rejectCompany(at('submitted'), 'admin', '  '), 'review.note_invalid'],
  [() => approveCompany(at('submitted', 'admin'), 'admin'), 'review.own_company'],
])('refuses %#', (run, code) => expect(run).toThrow(expect.objectContaining({ code })));
```

- [ ] **Step 2: Run it to see it fail.** Run `pnpm test -- src/modules/supplier/domain/registration.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the domain.** Field limits:
  - `legalName`: 2–160 characters.
  - `taxOffice`, `industryRegistryNumber` and `monthlyCapacity`: up to 120 characters.
  - Addresses: up to 300 characters.
  - `registryNumber`: 1–40 characters, or `registration.registry_number_invalid`.
  - `mersisNumber`: 16 digits.
  - `openSupplyHubId`: up to 20 characters `[A-Z0-9]`, or `registration.text_too_long`.
  - NACE codes: up to 10, deduped.
  - Certifications: up to 10. `validUntil` is a real calendar date in `YYYY-MM-DD`.
  - A blank string becomes `null`.

  The rules for `missingForSubmit` and the transitions:
  - `missingForSubmit` lists missing fields first, then the `doc:<key>` of every `requiredDocuments` group with no matching kind.
  - The owner may edit in `draft` and `changes_requested`.
  - Approving and asking for changes need `submitted`. Rejecting needs `submitted` or `approved`.
  - A note is 1–1000 characters once trimmed.
  - An admin whose user id equals `ownerUserId` gets `review.own_company`.
  - `diffRegistration` returns only the keys whose JSON differs.

- [ ] **Step 4: Change the schema and generate the migration.**
  - Add to `companies`: `status: text('status').notNull().default('draft')`.
  - Add `companyRegistrations`:
    - `companyId` is a uuid primary key, referencing `companies.id` on delete cascade.
    - Each text field of `Registration` becomes a nullable `text` column.
    - `naceCodes`: `text('nace_codes').array().notNull().default(sql\`'{}'::text[]\`)`.
    - `certifications`: `jsonb('certifications').$type<…>().notNull().default([])`.
    - `updatedAt`: a non-null `timestamptz` defaulting to now.
  - Add `companyReviewEvents`:
    - `id` is a uuid primary key; `companyId` is a uuid referencing `companies.id` on delete cascade.
    - `actorUserId` and `action` are non-null text; `note` is text.
    - `changes` is `jsonb`; `createdAt` is a non-null `timestamptz`.
    - Index `company_review_events_company_idx` on `(companyId, createdAt)`.
  - Run `pnpm db:generate --name company-registration`. Then replace the generated `ADD COLUMN "status"` line with these two lines, so that existing companies stay public:
    ```sql
    ALTER TABLE "companies" ADD COLUMN "status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
    ALTER TABLE "companies" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
    ```

- [ ] **Step 5: Add the repository round trips and a migration check** to `supplier.test.ts`
```ts
it('registers new companies as drafts and keeps the companies that existed before review public', async () => {
  const repos = createSupplierRepositories(await createTestDb());
  const c = await registerCompany(repos, { name: 'Aksu Denim', city: 'Istanbul', country: 'TR', ownerUserId: 'u1', contact, kind: 'fabric_mill' });
  expect((await repos.companies.findById(c.id))?.status).toBe('draft');
  const sql = await readFile('drizzle/0016_company-registration.sql', 'utf8');
  expect(sql).toMatch(/ADD COLUMN "status" text DEFAULT 'approved' NOT NULL/);
  expect(sql).toMatch(/ALTER COLUMN "status" SET DEFAULT 'draft'/);
});

it('round-trips a registration and its review events, and spots a taken tax number', async () => {
  // save normalizeRegistration('TR', c.id, TR) → find returns it toEqual;
  // add 2 events → listByCompany returns them oldest first;
  // a second TR company: taxIdTaken('TR', '1234567890', second.id) is false while the first is a draft, true once it is
  // submitted, changes_requested or approved, and false again once it is rejected
});
```
  `taxIdTaken` joins `companies` on country and checks `status in ('submitted','changes_requested','approved')`.

- [ ] **Step 6: Run the tests, then commit.**
  1. Run `pnpm test -- src/modules/supplier src/modules/discovery && pnpm typecheck`. Expected: PASS. The seeded companies are approved, so the discovery tests stay green.
  2. Commit with `git commit -m "feat(registration): company review status, registration details and review log"`.

### Task B3: Registration documents

**Files:**
- Create: `src/shared/domain/uploaded-file.ts`
- Create: `src/modules/supplier/domain/company-document.ts`
- Create: `src/modules/supplier/application/ports.ts`
- Create: `src/modules/supplier/application/company-documents.ts`
- Create: `src/modules/supplier/application/company-documents.test.ts`
- Create: `src/app/api/company-documents/[id]/route.ts`
- Create: `src/app/api/company-documents/[id]/route.test.ts`
- Modify: `src/modules/claims/domain/evidence.ts`, which now imports the shared helpers
- Modify: the supplier schema, repositories and index
- Modify: `src/server/container.ts`

**Interfaces:**
- Produces, in `src/shared/domain/uploaded-file.ts`:
  - `type UploadType = 'application/pdf' | 'image/jpeg' | 'image/png'`
  - `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`
  - `sniffFileType(bytes: Uint8Array): UploadType | null`
  - `safeFileName(raw: string, type: UploadType): string`
  - These are moved unchanged from `claims/domain/evidence.ts`, which keeps `sniffEvidenceType`, `EvidenceType` and `MAX_EVIDENCE_BYTES` as aliases.
- Produces, in `company-document.ts`:
  - `type CompanyDocument`, readonly: `{ id; companyId; kind: DocumentKind; fileName; contentType: UploadType; sizeBytes; storageKey; createdAt }`. The `storageKey` is `company-docs/${companyId}/${id}`.
  - `MAX_COMPANY_DOCUMENTS = 10`
  - `createCompanyDocument(input: { companyId: string; kind: string; fileName: string; bytes: Uint8Array }, now?: Date): CompanyDocument`. It throws `document.kind_invalid`, `evidence.too_large` or `evidence.type_invalid`.
- Produces, in `application/ports.ts`:
  - `interface DocumentStore { put(key, bytes, contentType): Promise<void>; get(key): Promise<Uint8Array | null>; delete(key): Promise<void> }`. It has the same shape as the claims `EvidenceStore`, so the container passes `evidenceStore` in.
- Produces the repository `CompanyDocumentRepository { save; findById; listByCompany; delete(id); deleteByCompany(companyId) }`, with table `company_documents` and index `(company_id)`.
- Produces these use cases:
  - `addCompanyDocument(deps: DocumentDeps, input: { userId; kind; fileName; bytes }): Promise<CompanyDocument>`
  - `removeCompanyDocument(deps, { userId, documentId }): Promise<void>`
  - `readCompanyDocument(deps, { documentId, viewer: { userId: string; isAdmin: boolean } }): Promise<{ document; bytes } | null>`
  - `purgeCompanyDocuments(deps, companyId): Promise<CompanyDocument[]>`. It returns what it deleted, logs each failure and never throws.
  - `type DocumentDeps = { companies: CompanyRepository; documents: CompanyDocumentRepository; store: DocumentStore }`

- [ ] **Step 1: Move the helpers.** Move `sniffEvidenceType` and `evidenceFileName` into `src/shared/domain/uploaded-file.ts`. Then run `pnpm test -- src/modules/claims`. Expected: PASS, unchanged.

- [ ] **Step 2: Write the failing tests.** In `company-documents.test.ts`, keep a `Map`-backed store the same way `claims/application/evidence.test.ts` does.
  - The owner adds a `tax_certificate` PDF. `listByCompany` then has 1 row, and the store holds the bytes at `company-docs/<companyId>/<id>`.
  - `kind: 'passport'` gives `document.kind_invalid`. The bytes `hello` give `evidence.type_invalid`.
  - An 11th document gives `document.too_many`.
  - Adding or removing while the company is `submitted` gives `registration.locked`.
  - Another user removing a document gives `document.not_found`. Another non-admin reading one gets `null`. An admin gets the bytes.
  - When `documents.save` throws, the stored bytes are deleted.
  - `purgeCompanyDocuments` removes the rows and the files. A store whose `delete` throws still removes the rows.

  In `route.test.ts`, copy `src/app/api/evidence/[id]/route.test.ts` and change it so that:
  - The owner and an admin get 200, with `attachment`, `nosniff` and `private, no-store`.
  - A stranger, an anonymous visitor and a malformed id all get the same empty 404.

- [ ] **Step 3: Run them to see them fail.** Run `pnpm test -- src/modules/supplier/application/company-documents.test.ts src/app/api/company-documents`. Expected: FAIL.

- [ ] **Step 4: Implement the domain, schema, repository, use cases and route.** Run `pnpm db:generate --name company-documents`. The route mirrors `/api/evidence/[id]` and passes `{ userId, isAdmin }` from `getViewer()`.

- [ ] **Step 5: Run the tests to see them pass, then commit.** Commit with `git commit -m "feat(registration): private registration documents for owners and admins"`.

### Task B4: The owner's registration page and submitting it

**Files:**
- Create: `src/modules/supplier/application/registration.ts`
- Create: `src/modules/supplier/application/registration.test.ts`
- Create: `src/app/[lang]/m/[company]/registration/page.tsx`
- Create: `src/app/[lang]/m/[company]/registration/actions.ts`
- Create: `src/app/[lang]/m/[company]/registration/actions.test.ts`
- Create: `src/app/[lang]/m/[company]/registration/messages.ts`
- Create: `src/app/[lang]/m/[company]/registration/registration-form.tsx`
- Create: `src/app/[lang]/m/[company]/registration/document-uploader.tsx`
- Create: `e2e/registration.spec.ts`
- Create: `e2e/fixtures/document.pdf`, containing the bytes `%PDF-1.4\n%%EOF\n`
- Modify: `src/server/modes.ts`. In `onboardingRedirect`, a company in manufacturer mode goes to `/add` when it is `approved` and to `/m/${slug}/registration` otherwise. The input type gains `company.status`.
- Modify: `src/server/modes.test.ts`
- Modify: `src/app/[lang]/onboarding/actions.ts`, which now redirects to the registration page
- Modify: `src/app/[lang]/m/[company]/page.tsx`. For the owner of a company that isn't approved, it shows a banner with the status and a link.
- Modify: `site-nav.tsx`, adding a Registration link in manufacturer mode
- Modify: `e2e/onboarding.spec.ts`, where `/add$` becomes `/registration$` for new companies

**Interfaces:**
- Consumes everything Tasks B2 and B3 produce.
- Produces:
  - `saveRegistration(deps: { companies; registrations }, { userId, input: RegistrationInput }): Promise<Registration>`. It throws `auth.forbidden` when the user has no company, and `registration.locked`.
  - `submitRegistration(deps: { companies; registrations; documents; reviewEvents }, { userId }): Promise<Company>`
  - The page's server actions:
    - `saveRegistrationAction(prev, form)`
    - `uploadCompanyDocumentAction(prev, form)`, with fields `kind` and `file`
    - `removeCompanyDocumentAction(documentId)`
    - `submitRegistrationAction()`

- [ ] **Step 1: Write the failing use-case tests**
  - Saving as the owner in `draft` makes `find` return the normalized registration.
  - Saving while `submitted` gives `registration.locked`. Saving with no company gives `auth.forbidden`.
  - Submitting with everything present sets the status to `submitted` and logs one `submitted` event.
  - Submitting with a document group missing gives `registration.incomplete`.
  - Submitting with a tax number already held by a `submitted` or `approved` company in the same country gives `registration.tax_id_taken`. A `rejected` holder doesn't block it.

- [ ] **Step 2: Run them to see them fail.** Run `pnpm test -- src/modules/supplier/application/registration.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the use cases.** `submitRegistration` works in this order:
  1. `missingForSubmit`
  2. `taxIdTaken`
  3. `submitCompany`
  4. `companies.save`
  5. `reviewEvents.add`

- [ ] **Step 4: Write the failing action test.** Mirror the way `src/app/[lang]/admin/claims/actions.test.ts` mocks `requireMill`.
  - Form fields map onto `RegistrationInput`:
    - `naceCodes` is split on `/[,;\s]+/`.
    - Certificates come from up to 3 rows: `cert0Scheme`, `cert0Number`, `cert0ValidUntil`, and the same for 1 and 2.
    - Blank rows are dropped.
  - A domain error echoes the values back, as onboarding does.
  - `submitRegistrationAction` calls `mailer.send` once per address in `config.adminEmails`. The subject is `New manufacturer to review: ${name}`. The text is `${name} (${country}) submitted its registration.\n\nReview it: ${baseUrl}/admin/manufacturers/${id}`. It sends from inside `after()`, which the test mocks to run immediately. A send failure is logged and not returned.

- [ ] **Step 5: Implement the page.**
  - It calls `requireMill()`, and `notFound()` unless the slug is the viewer's own company.
  - The banner shows the status from spec §7. For `changes_requested` and `rejected`, it shows the note from the latest event with that action.
  - A checklist turns each `missingForSubmit` key into a sentence in `messages.ts`.
  - The form sections are:
    - Legal identity: the tax number's label comes from `taxIdLabel`. Tax office, MERSİS and industrial registry fields show only when the country is `TR`.
    - Facility.
    - Activities: NACE codes, with the hint "Codes 10–33 are manufacturing; yours are on your faaliyet belgesi or tax certificate".
    - Size and capacity.
    - Certifications.
    - Open Supply Hub ID.
  - Below the form come the documents: a list with remove buttons, plus a kind `<select>` and an `<input type="file" accept="application/pdf,image/jpeg,image/png">`.
  - The Submit button is enabled only when the company can be edited and nothing is missing.
  - In `submitted`, `approved` and `rejected`, every input is `disabled`.

- [ ] **Step 6: Write the e2e test** in `e2e/registration.spec.ts`
```ts
test('a Turkish mill registers, uploads its documents and submits', async ({ page }) => {
  await signIn(page, 'aksu@example.test');
  // onboarding as in onboarding.spec.ts with name 'Aksu Denim', country TR
  await expect(page).toHaveURL(/\/m\/aksu-denim\/registration$/);
  await expect(page.getByText('Not public yet.')).toBeVisible();
  await page.getByLabel(/tax number \(vkn/i).fill('123 456 7891');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Enter a valid tax number for your country.')).toBeVisible();
  // fill: legal name, VKN 1234567890, registry no, registered + facility address, NACE "13.20"; save
  for (const kind of ['Tax certificate', 'Registry extract', 'Capacity report']) {
    await page.getByLabel(/document type/i).selectOption({ label: kind });
    await page.getByLabel(/file/i).setInputFiles('e2e/fixtures/document.pdf');
    await page.getByRole('button', { name: /upload/i }).click();
  }
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText('Under review.')).toBeVisible();
  await expect(page.getByLabel(/legal name/i)).toBeDisabled();
});
```

- [ ] **Step 7: Run the tests to see them pass, then commit.**
  1. Run `pnpm test -- src/modules/supplier src/app/[lang]/m src/server && pnpm e2e -- e2e/registration.spec.ts e2e/onboarding.spec.ts`. Expected: PASS.
  2. Commit with `git commit -m "feat(registration): owner registration page with documents and submit"`.

### Task B5: Only approved companies are public

**Files:**
- Create: `src/modules/discovery/infrastructure/visibility.ts`
- Modify in `src/modules/discovery/infrastructure/`: `product-page-view.ts`, `garment-tiles.ts`, `recently-tagged.ts`, `company-page-view.ts`, `article-page-view.ts`, `platform-stats.ts`, `types.ts`, `discovery.test.ts`
- Modify: `src/modules/discovery/index.ts`
- Modify: `src/app/sitemap.xml/route.ts`
- Modify: `src/app/[lang]/actions.ts`, where the search uses `hasPublicClaims`
- Modify: `src/app/[lang]/m/[company]/page.tsx` and `src/app/[lang]/m/[company]/a/[article]/page.tsx`
- Modify: `e2e/registration.spec.ts`

**Interfaces:**
- Produces:
  - `canSeeCompany(company: { status: CompanyStatus; ownerUserId: string }, viewer: { userId: string; isAdmin: boolean } | null): boolean`
  - `hasPublicClaims(db: Db, productId: string): Promise<boolean>`
- `CompanyPageView.company` and `ArticlePageView.company` gain `status`.
- `PlatformStats` gains `pendingSuppliers`, the number of companies in `submitted`.
- `getProductPageView` returns `null` when the product has no claim from an approved company.

- [ ] **Step 1: Write the failing tests** in `discovery.test.ts`. Use a fresh database in this test so that the shared one stays as it is.
```ts
it('keeps companies that are not approved off every public view', async () => {
  const db2 = await createTestDb();
  await seedDemo(db2);
  // save a draft company 'Gizli Mill' (owner 'u-gizli') with an original fabric claim on GUESS and an equivalent on LIU-JO,
  // and a product only Gizli claimed
  const v = await getProductPageView(db2, DEMO.products.guess);
  expect([...v!.fabric.originals, ...v!.fabric.equivalents].map((c) => c.company.name)).not.toContain('Gizli Mill');
  expect((await listRecentlyTagged(db2)).find((t) => t.productId === DEMO.products.liujo)?.equivalents).toBe(/* the count before Gizli */);
  expect(await getProductPageView(db2, gizliOnlyProductId)).toBeNull();
  expect(await hasPublicClaims(db2, gizliOnlyProductId)).toBe(false);
  expect(await getPlatformStats(db2)).toMatchObject({ suppliers: 4 });
  expect((await getCompanyPageView(db2, 'gizli-mill'))?.company.status).toBe('draft');
});

it.each([
  ['approved', null, true], ['draft', null, false], ['draft', { userId: 'u-gizli', isAdmin: false }, true],
  ['submitted', { userId: 'someone', isAdmin: false }, false], ['rejected', { userId: 'someone', isAdmin: true }, true],
] as const)('canSeeCompany(%s, %j) is %s', (status, viewer, expected) =>
  expect(canSeeCompany({ status, ownerUserId: 'u-gizli' }, viewer)).toBe(expected));
```

- [ ] **Step 2: Run them to see them fail.** Run `pnpm test -- src/modules/discovery`. Expected: FAIL.

- [ ] **Step 3: Implement the filter on `companies.status = 'approved'`.**
  - **Product page:** join `companies` in `getProductPageView` and add the status filter.
  - **Tile counts:** in `tileColumns`, the correlated subqueries become `select count(*)::int from claims k join companies kc on kc.id = k.company_id where k.product_id = … and k.kind = … and kc.status = 'approved'`.
  - **Recently tagged:** inner-join `companies` with the filter.
  - **Sitemap:** filter the product, company and article queries the same way.
  - **Stats:** `suppliers` counts approved companies; `pendingSuppliers` counts submitted ones.
  - **Pages:** the company and article pages call `notFound()` unless `canSeeCompany(view.company, viewer)`.
  - **Search:** the search action replaces `claims.existsForProduct` with `hasPublicClaims(db, product.id)`.

- [ ] **Step 4: Add the e2e assertion.** In `e2e/registration.spec.ts`, after submitting, a new browser context with nobody signed in gets 404 on `/m/aksu-denim`.

- [ ] **Step 5: Run the full suite and commit.**
```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
git commit -m "feat(registration): only approved companies appear publicly"
```

---

## Part C: Automatic third-party checks

### Task C1: Local checks and name matching

**Files:**
- Create: `src/modules/supplier/domain/checks.ts`
- Create: `src/modules/supplier/domain/checks.test.ts`

**Interfaces:**
- Consumes `foldText` from Task E1 (`src/shared/domain/fold.ts`) and the identifier rules from Task B1.
- Produces:
  - `type CheckSource = 'tax_id_format' | 'mersis_matches_tax_id' | 'nace_manufacturing' | 'email_domain' | 'eu_vies' | 'gleif'`
  - `type CheckOutcome = 'pass' | 'fail' | 'unknown'`
  - `type CheckResult`, readonly: `{ source: CheckSource; outcome: CheckOutcome; summary: string; checkedAt: Date }`
  - `type CheckSubject`, readonly: `{ country; legalName: string | null; taxId: string | null; mersisNumber: string | null; lei: string | null; naceCodes: readonly string[]; website: string | null; ownerEmail: string | null }`
  - `localChecks(s: CheckSubject, now?: Date): CheckResult[]`
  - `legalNameMatches(a: string, b: string): boolean`
  - `CHECK_ORDER: readonly CheckSource[]`

- [ ] **Step 1: Write the failing test**
```ts
const S = { country: 'TR', legalName: 'Aksu Denim Tekstil San. ve Tic. A.Ş.', taxId: '1234567890', mersisNumber: '0123456789000015', lei: null,
  naceCodes: ['13.20'], website: 'https://aksu-denim.com.tr/', ownerEmail: 'ali@aksu-denim.com.tr' };
const outcome = (s: Partial<typeof S>) => Object.fromEntries(localChecks({ ...S, ...s }).map((r) => [r.source, r.outcome]));

it('passes a consistent Turkish manufacturer', () =>
  expect(outcome({})).toEqual({ tax_id_format: 'pass', mersis_matches_tax_id: 'pass', nace_manufacturing: 'pass', email_domain: 'pass' }));
it('never fails on the MERSİS pattern, which only third parties document', () => expect(outcome({ mersisNumber: '0999999999000015' }).mersis_matches_tax_id).toBe('unknown'));
it('fails a company with no manufacturing activity', () => expect(outcome({ naceCodes: ['46.41'] }).nace_manufacturing).toBe('fail'));
it.each([['ali@gmail.com', 'unknown'], ['ali@sales.aksu-denim.com.tr', 'pass'], ['ali@other.com', 'unknown']])('email %s → %s', (ownerEmail, expected) =>
  expect(outcome({ ownerEmail }).email_domain).toBe(expected));
it('has no email check without a website', () => expect(outcome({ website: null }).email_domain).toBe('unknown'));

it.each([
  ['AKSU DENİM TEKSTİL SANAYİ VE TİCARET ANONİM ŞİRKETİ', 'Aksu Denim Tekstil San. ve Tic. A.Ş.', true],
  ['Indigo Mill GmbH', 'INDIGO MILL', true],
  ['KOÇ HOLDİNG ANONİM ŞİRKETİ', 'Koc Holding A.S.', true],
  ['Indigo Mill GmbH', 'Indigo Weaving GmbH', false],
  ['Aksu Denim', 'Denim', false], // a one-word subset is too weak
  ['A.Ş.', 'Ltd. Şti.', false],
])('legalNameMatches(%s, %s) is %s', (a, b, expected) => expect(legalNameMatches(a, b)).toBe(expected));
```

- [ ] **Step 2: Run it to see it fail, then implement.**
  - The outcome rules for each check are in spec §5.
  - Name matching uses `foldText`, then drops one-letter tokens and the words in spec §9.6.
  - Free-mail domains are `gmail.com hotmail.com outlook.com yahoo.com icloud.com yandex.com yandex.com.tr mail.ru proton.me`.
  - Each summary is one plain English sentence for the admin, such as `VKN checksum valid` or `TCKN (sole proprietor) checksum valid`.

- [ ] **Step 3: Run the test to see it pass, then commit.** Commit with `git commit -m "feat(checks): local registration checks and legal-name matching"`.

### Task C2: VIES and GLEIF adapters

**Files:**
- Create: `src/modules/supplier/infrastructure/registry-checkers.ts`
- Create: `src/modules/supplier/infrastructure/registry-checkers.test.ts`

**Interfaces:**
- Produces:
  - `type RegistryChecker = (s: CheckSubject) => Promise<CheckResult | null>`. It returns `null` when the check doesn't apply.
  - `createViesChecker(fetchFn: typeof fetch = fetch): RegistryChecker`
  - `createGleifChecker(fetchFn: typeof fetch = fetch): RegistryChecker`

- [ ] **Step 1: Write the failing test.** Use a fake `fetchFn` that records the URL and returns `Response.json(fixture, { status })`. The fixtures copy the shapes from spec §5 and the live responses: VIES `{ isValid, userError, name, address }`, and GLEIF `data.attributes.entity.{legalName.name,status,legalAddress.country}` and `registration.status`.
  - **VIES:**
    - A DE company with `taxId: 'DE123456789'` calls `…/rest-api/ms/DE/vat/123456789`. A GR one calls `ms/EL/vat/…`.
    - Each response maps like this:

      | Response | Outcome |
      |---|---|
      | `isValid: true` with a matching name | `pass` |
      | `name: '---'` | `pass`, with a summary saying the name isn't shared |
      | a valid number with a different name | `unknown` |
      | `isValid: false, userError: 'INVALID'` | `fail` |
      | `userError: 'MS_UNAVAILABLE'` | `unknown` |
      | HTTP 500 | `unknown` |
      | a body that isn't JSON | `unknown` |
      | `fetchFn` rejects with an `AbortError` | `unknown` |
    - A TR company, or one without a tax number, gets `null`.
  - **GLEIF:**
    - An LEI calls `…/lei-records/5493001KJTIIGC8Y1R12`. With `ACTIVE` and `ISSUED`, a matching name and the same country, the outcome is `pass`.
    - A 404 gives `fail`.
    - A `LAPSED` registration gives `unknown`.
    - With no LEI, it calls `…/lei-records?filter[fulltext]=…&filter[entity.legalAddress.country]=TR&page[size]=5`. A match gives `pass`, with the LEI in the summary. No match gives `null`. A network error gives `null`.

- [ ] **Step 2: Run it to see it fail, then implement.**
  - Every call passes `{ signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } }`.
  - Wrap the whole function body in `try`/`catch` and map any error as above.

- [ ] **Step 3: Run the test to see it pass, then commit.** Commit with `git commit -m "feat(checks): EU VIES and GLEIF registry checks"`.

### Task C3: Running and storing checks

**Files:**
- Create: `src/modules/supplier/application/run-checks.ts`
- Create: `src/modules/supplier/application/run-checks.test.ts`
- Create: `src/modules/identity/infrastructure/users.ts`
- Modify: the supplier schema, repositories and index, adding table `company_checks` with primary key `(company_id, source)`
- Modify: `src/modules/identity/index.ts`
- Modify: `src/server/container.ts`
- Modify: `src/app/[lang]/m/[company]/registration/actions.ts`

**Interfaces:**
- Consumes everything Tasks C1 and C2 produce.
- Produces:
  - `CheckRepository { replaceAll(companyId: string, results: readonly CheckResult[]): Promise<void>; list(companyId: string): Promise<CheckResult[]> }`. `replaceAll` runs in one `db.transaction`. `list` returns results in `CHECK_ORDER`.
  - `findUserEmail(db: Db, userId: string): Promise<string | null>`, exported from `@/modules/identity`
  - `runRegistrationChecks(deps: { companies; registrations; checks: CheckRepository; checkers: readonly RegistryChecker[]; ownerEmail: (userId: string) => Promise<string | null> }, companyId: string): Promise<CheckResult[]>`
  - The container gains `checks` and `checkers: [createViesChecker(), createGleifChecker()]`.

- [ ] **Step 1: Write the failing test.**
  - Fake checkers: one returns a `pass`, one throws, one returns `null`. The stored result is the local checks plus that one `pass`, and the error is logged.
  - Running again replaces what was stored, so no stale `eu_vies` row remains.
  - A missing company gives `[]`.

- [ ] **Step 2: Implement.**
  - `runRegistrationChecks` builds the `CheckSubject` from the company (country and `contact.website`), the registration and `ownerEmail(company.ownerUserId)`.
  - It runs `Promise.allSettled` over the checkers.
  - `submitRegistrationAction` adds `after(() => runRegistrationChecks(...).catch((e) => console.error('[checks]', e)))`.
  - Run `pnpm db:generate --name company-checks`.

- [ ] **Step 3: Run the tests to see them pass, then commit.**
  1. Run `pnpm test -- src/modules/supplier src/app/[lang]/m`. Expected: PASS.
  2. Run `pnpm test && pnpm lint && pnpm typecheck && pnpm e2e`.
  3. Commit with `git commit -m "feat(checks): run registration checks on submit and store the latest per source"`.

---

## Part D: Admin review

### Task D1: Review use cases, history and owner emails

**Files:**
- Create: `src/modules/supplier/application/review-registration.ts`
- Create: `src/modules/supplier/application/review-registration.test.ts`
- Modify: `src/modules/supplier/index.ts`
- Modify: `src/app/_lib/error-messages.ts`

**Interfaces:**
- Consumes everything Tasks B2, B3 and C3 produce.
- Produces:
  - `type ReviewDeps = { companies; registrations; reviewEvents; documents: CompanyDocumentRepository; store: DocumentStore; mailer: Mailer; ownerEmail: (userId: string) => Promise<string | null>; baseUrl: string }`
  - `approveRegistration(deps: ReviewDeps, { companyId, adminUserId }): Promise<Company>`
  - `rejectRegistration(deps, { companyId, adminUserId, note }): Promise<Company>`
  - `requestRegistrationChanges(deps, { companyId, adminUserId, note }): Promise<Company>`
  - `editRegistrationAsAdmin(deps: Pick<ReviewDeps, 'companies' | 'registrations' | 'reviewEvents'>, { companyId, adminUserId, input: RegistrationInput }): Promise<Registration>`
  - A missing company throws `company.not_found`.

- [ ] **Step 1: Write the failing tests**
  - **Approve:** `submitted` becomes `approved`. One `approved` event is logged, with `changes: { documents: [['tax_certificate: vergi.pdf', …], null] }`. The documents' rows and files are gone. One email goes to the owner.
  - **Reject:** rejecting an approved company sets `rejected` and purges the documents. An empty note gives `review.note_invalid`.
  - **Request changes:** sets `changes_requested`, keeps the documents and emails the note. Afterwards `saveRegistration` by the owner succeeds.
  - **Own company:** an admin who owns the company gets `review.own_company` on approve, reject, request-changes and edit.
  - **Failed email:** when `mailer.send` throws, the decision is still saved and the error is logged.
  - **Edit:** changing `taxOffice` and `facilityAddress` logs one `edited` event with `changes` for exactly those two keys. The status doesn't change. An invalid tax number gives `registration.tax_id_invalid`.

- [ ] **Step 2: Implement.**
  - Each decision runs: domain transition, `companies.save`, `reviewEvents.add`, purge if it is approve or reject, then the email.
  - The email step catches and logs its own errors.
  - The email copy is fixed:
    - **Approved:**
      - Subject: `Your company is approved on xbul / Firmanız xbul’da onaylandı`
      - Text: `${name} is approved. Your company and products are now public:\n${baseUrl}/m/${slug}\n\n${name} onaylandı. Firmanız ve ürünleriniz artık herkese açık:\n${baseUrl}/tr/m/${slug}`
    - **Changes requested:**
      - Subject: `xbul needs more information / xbul ek bilgi istiyor`
      - Text: `We need more information before we can approve ${name}:\n\n${note}\n\nUpdate your registration: ${baseUrl}/m/${slug}/registration\n\n${name} kaydını onaylamadan önce ek bilgiye ihtiyacımız var (yukarıdaki nota bakın): ${baseUrl}/tr/m/${slug}/registration`
    - **Rejected:**
      - Subject: `Your xbul registration was not approved / xbul kaydınız onaylanmadı`
      - Text: `${name} was not approved:\n\n${note}\n\nQuestions: hello@xbul.io\n\n${name} onaylanmadı (yukarıdaki nota bakın). Sorularınız için: hello@xbul.io`

- [ ] **Step 3: Run the tests to see them pass, then commit.** Commit with `git commit -m "feat(review): approve, reject, request changes and edit registrations"`.

### Task D2: Admin manufacturer queue and review page

**Files:**
- Create: `src/modules/discovery/infrastructure/registration-review.ts`
- Create the queue page: `src/app/[lang]/admin/manufacturers/page.tsx` and `messages.ts`
- Create the review page in `src/app/[lang]/admin/manufacturers/[id]/`: `page.tsx`, `actions.ts`, `actions.test.ts`, `messages.ts`, `decision-forms.tsx`, `edit-form.tsx`, `manual-checks.ts`
- Create: `e2e/admin-manufacturers.spec.ts`
- Modify: `src/modules/discovery/index.ts` and `discovery.test.ts`
- Modify: `src/server/modes.ts`, where the admin home becomes `'/admin/manufacturers'`. Update the expectations in `src/server/modes.test.ts`, `e2e/modes.spec.ts` and `e2e/admin.spec.ts` that still say `/admin/claims`.
- Modify: `site-nav.tsx`, adding a Manufacturers link in admin mode
- Modify: `src/server/demo-ids.ts` and `src/server/seed-demo.ts`
- Modify: `src/app/[lang]/m/[company]/page.tsx`, which lists certifications once a company is approved
- Modify: `README.md`, adding a section on roles and registration under Structure

**Interfaces:**
- Consumes everything Tasks B2–D1 produce.
- Produces:
  - `listRegistrations(db: Db, status: CompanyStatus): Promise<RegistrationRow[]>`, where `RegistrationRow = { companyId; slug; name; kind; country; status; submittedAt: Date | null; checks: { pass: number; fail: number; unknown: number } }`. `submitted` is listed with the oldest `submittedAt` first; every other status with the newest first.
  - `getRegistrationReview(db: Db, companyId: string): Promise<RegistrationReview | null>`, where `RegistrationReview = { company: CompanyRef & { status; ownerUserId; ownerEmail: string | null }; registration: Registration | null; documents: { id; kind; fileName; sizeBytes }[]; checks: CheckResult[]; events: ReviewEvent[]; missing: string[] }`
  - The server actions:
    - `approveRegistrationAction(companyId)`
    - `rejectRegistrationAction(companyId, prev, form)`
    - `requestChangesAction(companyId, prev, form)`
    - `editRegistrationAction(companyId, prev, form)`
    - `rerunChecksAction(companyId)`
    - Each calls `requireAdmin()` first and validates the UUID. It passes `userId` from the viewer and calls `revalidatePath('/', 'layout')`.
  - `MANUAL_CHECKS: Record<'TR' | 'default', { label: string; url: string }[]>`, built from the manual rows of spec §5. Open Supply Hub is added when `openSupplyHubId` is set.
- Demo data: `DEMO.users.pending`, `DEMO.emails.pending` (`'pending@example.test'`), and companies `ege` and `marmara` with slugs `ege-orme` and `marmara-denim`. Both have a full TR registration and status `submitted`, with no documents.

- [ ] **Step 1: Write the failing read-model tests** in `discovery.test.ts`
  - `listRegistrations(db, 'submitted')` returns `['Ege Örme', 'Marmara Denim']` in that order.
  - `getRegistrationReview(db, DEMO.companies.ege)` has `ownerEmail: 'pending@example.test'`, the registration, `missing: ['doc:tax_certificate', 'doc:registry_extract', 'doc:manufacturing_proof']` and `events: []`.
  - An unknown id gives `null`.
- [ ] **Step 2: Write the failing action tests.** Mirror `admin/claims/actions.test.ts`.
  - A non-admin is refused before any work happens.
  - A malformed id gives the generic error.
  - Approving changes the status. Rejecting with an empty note returns the `review.note_invalid` copy.
- [ ] **Step 3: Implement the read models, the pages and the actions.**
  - **Queue:** tabs `?status=submitted|changes_requested|approved|rejected|draft`, defaulting to `submitted`. Each row shows the name, country, kind, the time since submission and the check counts.
  - **Review page sections:**
    - Company and registration fields.
    - Checks, each with an outcome chip and its summary, plus a "Re-run checks" button.
    - Manual checks, as links.
    - Documents, linking to `/api/company-documents/{id}`.
    - Missing items.
    - History, newest first: action, actor, time, note, and for edits the changes as `field: before → after`.
    - The actions: Approve (with a confirm), Request changes (needs a note), Reject (needs a note), and Edit (the registration form prefilled).
  - **Own company:** when `viewer.userId === company.ownerUserId`, hide every action and show EN "You own this company. Another admin must review it." / TR "Bu firma size ait. Başka bir yönetici incelemeli."
- [ ] **Step 4: Write the e2e tests**
```ts
test('an admin asks for changes and the owner sees why', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.getByRole('link', { name: 'Manufacturers' }).click();
  await page.getByRole('link', { name: 'Ege Örme' }).click();
  await page.getByLabel(/note/i).first().fill('Upload your kapasite raporu.');
  await page.getByRole('button', { name: /request changes/i }).click();
  await expect(page.getByText('Changes requested')).toBeVisible();
  await signIn(page, 'pending@example.test');
  await page.goto('/m/ege-orme/registration');
  await expect(page.getByText('Upload your kapasite raporu.')).toBeVisible();
});

test('approving makes the company public', async ({ page, browser }) => {
  const visitor = await (await browser.newContext()).newPage();
  expect((await visitor.goto('/m/marmara-denim'))?.status()).toBe(404);
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/manufacturers');
  await page.getByRole('link', { name: 'Marmara Denim' }).click();
  await page.getByRole('button', { name: /approve/i }).click();
  await page.getByRole('button', { name: /confirm/i }).click();
  expect((await visitor.goto('/m/marmara-denim'))?.status()).toBe(200);
});
```
- [ ] **Step 5: Run the full suite and commit.**
```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
git commit -m "feat(review): admin manufacturer queue and review page"
```

---

## Part E: Product classification

### Task E1: The taxonomy

**Files:**
- Create: `src/shared/domain/fold.ts`
- Create in `src/shared/domain/taxonomy/`: `parts.ts`, `fibres.ts`, `product-types.ts`, `index.ts`, `taxonomy.test.ts`

**Interfaces:**
- Produces:
  - `foldText(s: string): string`. It lower-cases with `toLowerCase()`, applies NFKD, removes `\p{M}`, and maps `ı` to `i`.
  - `type Localized = { en: string; tr: string }`
  - `type PartId = 'garment' | 'fabric' | 'yarn' | 'trims' | 'sewing' | 'washing' | 'printing'`
  - `PARTS: readonly { id: PartId; full: boolean; label: Localized }[]`, in the order of spec §9.1
  - `isFullProduct(p: PartId): boolean`
  - `type FibreCode`, holding the 16 codes in spec §9.2
  - `FIBRES: Readonly<Record<FibreCode, { name: Localized; genericName: string; latin: string | null; group: 'natural' | 'man_made' }>>`
  - `normalizeFibreCode(raw: string): FibreCode | null`
  - `type ProductTypeId`, holding the 11 ids in spec §9.5
  - `PRODUCT_TYPES: Readonly<Record<ProductTypeId, { name: Localized; hs: readonly string[] }>>`
  - `guessProductType(name: string): ProductTypeId | null`
  - `formatHs(codes: readonly string[]): string`, which turns `['6203.42','6204.62']` into `'HS 6203.42 / 6204.62'`

- [ ] **Step 1: Write the failing test**
```ts
it('exactly one part is the full product', () => expect(PARTS.filter((p) => p.full).map((p) => p.id)).toEqual(['garment']));
it.each([['co', 'CO'], ['EA', 'EL'], ['pl', 'PES'], ['NY', 'PA'], ['PE', null], ['XX', null]])('normalizeFibreCode(%s) → %s', (raw, code) =>
  expect(normalizeFibreCode(raw)).toBe(code));
it('natural fibres carry their Latin names', () => expect(FIBRES.CO.latin).toBe('Gossypium spp.'));
it.each([
  ['Cropped Denim Blazer', 'jacket'], ['Printed Denim Jacket', 'jacket'], ['Trucker Jacket', 'jacket'], ['Skinny JEANS', 'jeans'],
  ['Kot Pantolon', 'jeans'], ['Denim Shorts', 'shorts'], ['Basic T-Shirt', 't_shirt'], ['Shirt Dress', 'dress'], ['Oversize Sweatshirt', 'knit_top'],
  ['Takım Elbise', 'suit'], ['TİŞÖRT', 't_shirt'], ['Linen Overshirt', 'shirt'], ['Wide Leg Trousers', 'trousers'], ['Leather Belt', null],
])('guessProductType(%s) → %s', (name, id) => expect(guessProductType(name)).toBe(id));
it('formats HS codes', () => expect(formatHs(PRODUCT_TYPES.jeans.hs)).toBe('HS 6203.42 / 6204.62'));
```
- [ ] **Step 2: Run it to see it fail, then implement.**
  - Copy the tables from spec §9.1, §9.2 and §9.5 as typed constants.
  - `guessProductType` runs `foldText`, replaces `-` with a space, then tries the spec's patterns in order.
- [ ] **Step 3: Run the test to see it pass, then commit.** Commit with `git commit -m "feat(taxonomy): parts, fibres and product types with HS codes"`.

### Task E2: Fabric technical sheet on product codes

**Files:**
- Create: `src/shared/domain/taxonomy/fabric.ts`
- Create: `src/shared/domain/taxonomy/fabric.test.ts`
- Create in `src/app/[lang]/m/[company]/a/[article]/`: `edit-fabric-form.tsx`, `fabric-messages.ts`
- Modify: `src/modules/supplier/domain/article.ts`, where `Article` gains `fabric: FabricSpec | null`, and `withFabric` is added
- Create: `src/modules/supplier/application/edit-article-fabric.ts`
- Modify: `src/modules/supplier/application/supplier.test.ts`
- Modify: the supplier schema (`articles.fabric jsonb`), repositories and index
- Modify in `src/modules/discovery/infrastructure/`: `types.ts`, `product-page-view.ts`, `article-page-view.ts`
- Modify: in the article page folder, `actions.ts`, `actions.test.ts` and `page.tsx`
- Modify: `src/app/[lang]/p/[id]/page.tsx`

**Interfaces:**
- Consumes everything Task E1 produces.
- Produces:
  - `type FabricSpec`, readonly: `{ construction: Construction; pattern: Pattern; twill: { ratio: '2/1' | '3/1' | '2/2'; direction: 'rht' | 'lht' | 'broken' } | null; fibres: readonly { code: FibreCode; percent: number }[]; weightGsm: number; widthCm: number | null; dye: DyeMethod | null; finishes: readonly Finish[] }`. The ids come from spec §9.3.
  - `type FabricSpecInput`, where every field is optional `string | number`, plus:
    - `fibres?: { code: string; percent: string | number }[]`
    - `weightUnit?: string`
    - `finishes?: string[]`
  - `normalizeFabricSpec(input: FabricSpecInput): FabricSpec`
  - `isDenim(s: FabricSpec): boolean`
  - `fabricHsCode(s: FabricSpec): string | null`
  - `describeFabric(s: FabricSpec, lang: 'en' | 'tr'): string[]`
  - `GSM_PER_OZ = 33.906`
  - `withFabric(a: Article, input: FabricSpecInput | null): Article`
  - `editArticleFabric(deps: { articles; companies }, { userId, articleId, input: FabricSpecInput | null }): Promise<Article>`. Ownership works as in `editArticleSpecs`.
  - `editArticleFabricAction(prev, form)`. The form fields are:
    - `construction`, `pattern`, `twillRatio`, `twillDirection`
    - `fibre0..3` with `percent0..3`
    - `weight` with `weightUnit` (`gsm` or `oz`)
    - `widthCm`, `dye`
    - `finishes`, repeated
    - An empty `construction` clears the sheet.
  - `ClaimView.article` and `ArticlePageView.article` gain `fabric: FabricSpec | null`.

- [ ] **Step 1: Write the failing test** in `fabric.test.ts`
```ts
const DENIM = { construction: 'woven', pattern: 'twill', twillRatio: '3/1', twillDirection: 'rht',
  fibres: [{ code: 'co', percent: '98' }, { code: 'EA', percent: 2 }], weight: '12.5', weightUnit: 'oz', widthCm: '150', dye: 'rope', finishes: ['sanforized'] };

it('normalizes a denim sheet into standard codes and g/m²', () => {
  expect(normalizeFabricSpec(DENIM)).toEqual({ construction: 'woven', pattern: 'twill', twill: { ratio: '3/1', direction: 'rht' },
    fibres: [{ code: 'CO', percent: 98 }, { code: 'EL', percent: 2 }], weightGsm: 424, widthCm: 150, dye: 'rope', finishes: ['sanforized'] });
});

it('describes it in sector terms, in both languages', () => {
  const s = normalizeFabricSpec(DENIM);
  expect(describeFabric(s, 'en')).toEqual(['Woven · 3/1 right-hand twill (RHT)', 'Denim', '98% Cotton (CO, Gossypium spp.) · 2% Elastane (EL)',
    '424 g/m² (12.5 oz/yd²)', '150 cm wide', 'Rope-dyed', 'Sanforized', 'HS 5209.42']);
  expect(describeFabric(s, 'tr')).toEqual(['Dokuma · 3/1 sağ dimi (RHT)', 'Denim', '%98 Pamuk (CO, Gossypium spp.) · %2 Elastan (EL)',
    '424 g/m² (12,5 oz/yd²)', '150 cm en', 'Halat boyama', 'Sanforlu', 'HS 5209.42']);
});

const spec = (patch: object) => normalizeFabricSpec({ ...DENIM, ...patch });
it.each([
  [{}, '5209.42'],
  [{ weight: '180', weightUnit: 'gsm' }, '5208'],
  [{ weight: '200', weightUnit: 'gsm', fibres: [{ code: 'CO', percent: 100 }] }, '5208'],
  [{ dye: 'piece_dyed' }, '5209'],
  [{ fibres: [{ code: 'CO', percent: 70 }, { code: 'PES', percent: 30 }], weight: '300', weightUnit: 'gsm' }, '5211.42'],
  [{ pattern: 'plain', twillRatio: '', twillDirection: '', fibres: [{ code: 'CO', percent: 70 }, { code: 'PES', percent: 30 }], weight: '150', weightUnit: 'gsm' }, '5210'],
  [{ fibres: [{ code: 'CO', percent: 60 }, { code: 'LI', percent: 40 }], weight: '250', weightUnit: 'gsm' }, '5212'],
  [{ fibres: [{ code: 'CO', percent: 50 }, { code: 'PES', percent: 50 }] }, null],
  [{ construction: 'knitted', pattern: 'single_jersey', twillRatio: '', twillDirection: '' }, null],
])('fabricHsCode(%j) → %s', (patch, hs) => expect(fabricHsCode(spec(patch))).toBe(hs));

it.each([
  [{ construction: 'felt' }, 'fabric.construction_invalid'],
  [{ pattern: 'rib' }, 'fabric.pattern_invalid'],
  [{ twillRatio: '' }, 'fabric.twill_invalid'],
  [{ pattern: 'plain' }, 'fabric.twill_invalid'], // plain weave with a twill ratio
  [{ fibres: [] }, 'fabric.fibre_invalid'],
  [{ fibres: [{ code: 'CO', percent: 50 }, { code: 'co', percent: 50 }] }, 'fabric.fibre_invalid'],
  [{ fibres: [{ code: 'CO', percent: 97.5 }, { code: 'EL', percent: 2.5 }] }, 'fabric.fibre_invalid'],
  [{ fibres: [{ code: 'CO', percent: 98 }, { code: 'EL', percent: 3 }] }, 'fabric.composition_total'],
  [{ weight: '10', weightUnit: 'gsm' }, 'fabric.weight_invalid'],
  [{ weightUnit: 'kg' }, 'fabric.weight_invalid'],
  [{ widthCm: '20' }, 'fabric.width_invalid'],
  [{ dye: 'tie_dye' }, 'fabric.dye_invalid'],
  [{ finishes: ['laser'] }, 'fabric.finish_invalid'],
])('rejects %j', (patch, code) => expect(() => spec(patch)).toThrow(expect.objectContaining({ code })));
```
- [ ] **Step 2: Run it to see it fail, then implement.**
  - Blank strings count as absent.
  - Validate in this order, so each test case gets the error it expects: construction, pattern, twill, fibres, composition total, weight, width, dyeing, finishes.
  - Converting oz: `Math.round(oz * GSM_PER_OZ)`.
  - Displaying oz: `toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 })`.
  - `isDenim` follows spec §9.3 and `fabricHsCode` follows spec §9.4.
  - The chip order is:
    1. construction · pattern or twill
    2. Denim, when it is denim
    3. composition, with Latin names for natural fibres
    4. weight
    5. width, if set
    6. dyeing, if set
    7. each finish
    8. HS code, if any
  - Turkish puts `%` before the number.
- [ ] **Step 3: Add the article round trip.** In `supplier.test.ts`:
  - The owner saves `DENIM` on 60219/1, and `findById` returns `fabric.weightGsm === 424`.
  - Another user gets `auth.forbidden`.
  - `input: null` clears the sheet.

  Run `pnpm db:generate --name article-fabric`.
- [ ] **Step 4: Update the pages.**
  - **Article page, owner:** an "Technical sheet" / "Teknik föy" form.
    - Selects for construction, pattern, twill ratio, twill direction, dyeing and the weight unit.
    - 4 fibre rows, each a code `<select>` from `FIBRES` plus a percent.
    - Checkboxes for the finishes.
  - **Article page, everyone:** the `describeFabric` chips. When `fabric` is set, hide the legacy free-text weight, composition and finish, and keep MOQ and lead time.
  - **Product page:** each claim card shows the first 3 chips of its article's sheet.
- [ ] **Step 5: Run the tests, then commit.**
  1. Run `pnpm test -- src/shared src/modules/supplier src/modules/discovery src/app/[lang]/m`. Expected: PASS.
  2. Commit with `git commit -m "feat(taxonomy): fabric technical sheet with standard terms and HS code"`.

### Task E3: Product type on brand products

**Files:**
- Modify: `src/modules/catalog/domain/product.ts`, where `Product` gains `type: ProductTypeId | null`
- Modify: `src/modules/catalog/domain/repositories.ts`, `infrastructure/schema.ts`, `infrastructure/drizzle-product-repository.ts`, `index.ts`
- Create: `src/modules/catalog/application/set-product-type.ts`
- Modify: `src/modules/catalog/application/catalog.test.ts`
- Modify in `src/app/[lang]/add/`: `actions.ts`, `actions.test.ts`, `add-garments-form.tsx`, `messages.ts`
- Modify: `src/modules/discovery/infrastructure/types.ts` and `product-page-view.ts`, where `ProductPageView.product` gains `type`
- Modify: `src/app/[lang]/p/[id]/page.tsx`

**Interfaces:**
- Consumes everything Task E1 produces.
- Produces:
  - `ProductRepository.setTypeIfNull(id: string, type: ProductTypeId): Promise<void>`, a single `UPDATE … WHERE id = $1 AND type IS NULL`.
  - `setProductTypeIfEmpty(deps: { products }, { productId, type }: { productId: string; type: string }): Promise<void>`. It throws `product.not_found` or `product.type_invalid`.
  - The ready `PreviewRow` gains `type: ProductTypeId | null` and `typeLocked: boolean`. `type` is the stored type, or failing that `guessProductType(name)`; `typeLocked` is true when a type is stored.
  - `publishGarmentsAction` items gain `type: string`. An empty string means "not sure".

- [ ] **Step 1: Write the failing tests**
  - **Catalog:**
    - `setProductTypeIfEmpty` sets `jeans` on a product with no type.
    - A second call with `jacket` leaves `jeans`, so the first claimer wins.
    - `wizard` gives `product.type_invalid`.
    - An unknown product gives `product.not_found`.
  - **Add actions:**
    - The preview of a product named "Skinny Jeans" has `type: 'jeans', typeLocked: false`.
    - Publishing with `type: 'jeans'` stores it.
    - Publishing with `type: ''` stores nothing.
- [ ] **Step 2: Implement.**
  - Run `pnpm db:generate --name product-type`.
  - Each preview row gets a `<select aria-label="Product type">`. It lists the localized `PRODUCT_TYPES` names, with "Not sure" / "Emin değilim" as the empty value. It is disabled when `typeLocked`.
  - After `publishGarments` succeeds, call `setProductTypeIfEmpty` for each item with a type, before the redirect.
  - The product page shows `{type name} · {formatHs(hs)}` under the product name.
- [ ] **Step 3: Run the tests to see them pass, then commit.** Commit with `git commit -m "feat(taxonomy): product type with HS code on brand products"`.

### Task E4: Every part of a product, flagged full or partial

**Files:**
- Modify: `src/modules/claims/domain/claim.ts`, where `ClaimScope = PartId`
- Modify: `src/modules/supplier/domain/company.ts`, where `CompanyKind` has 7 values and `COMPANY_KINDS` is exported
- Modify: `src/modules/supplier/domain/company.test.ts`
- Modify: `src/modules/discovery/infrastructure/types.ts`, `product-page-view.ts`, `discovery.test.ts`
- Modify: `src/app/[lang]/p/[id]/page.tsx` and `messages.ts`
- Modify: `src/app/[lang]/onboarding/actions.ts`, `onboarding-form.tsx`, `messages.ts`
- Modify: `src/app/[lang]/m/[company]/messages.ts`, where `KIND_EN` and `KIND_TR` gain the new kinds
- Modify: `src/app/[lang]/admin/claims/messages.ts`, where scope labels cover every part
- Modify: `src/app/_lib/error-messages.ts`, with the new `company.kind_invalid` copy

**Interfaces:**
- Consumes everything Task E1 produces.
- Produces:
  - `COMPANY_KINDS = ['garment_maker', 'fabric_mill', 'yarn_spinner', 'trims_maker', 'sewing_contractor', 'laundry', 'print_house'] as const`
  - `claimScopeOf(kind: CompanyKind): PartId`, using the map in spec §9.1
  - `ProductPageView` replaces `fabric` and `garment` with `parts: { part: PartId; full: boolean; originals: ClaimView[]; equivalents: ClaimView[] }[]`. The array is in `PARTS` order and has no empty parts.

- [ ] **Step 1: Update the tests first.**
  - In `discovery.test.ts`, read `v.parts.find((p) => p.part === 'fabric')` and the `garment` part in place of `v.fabric` and `v.garment`.
  - Add a test: a `laundry` company "Marmara Yıkama" with an original claim on GUESS. Expected: `v.parts.map((p) => [p.part, p.full])` equals `[['garment', true], ['fabric', false], ['washing', false]]`.
  - In `company.test.ts`, the `claimScopeOf` table covers all 7 kinds, and `'wizard'` still gives `company.kind_invalid`.
- [ ] **Step 2: Run them to see them fail, then implement.**
  - **Onboarding:** offer the 7 kinds as radios, using the spec §9.1 option copy, and validate them with `z.enum(COMPANY_KINDS)`.
  - **Product page:** render one `SupplierSection` per part, with `testId={\`${part}-suppliers\`}` so the existing e2e selectors keep working.
    - Title: EN `Who made the ${label}`, or `Who made it` for the full product; TR `${label} kimin`, or `Üretici` for the full product.
    - Badge: "Full product" / "Tam ürün", or "Partial · {label}" / "Kısmi · {label}".
    - The structured data uses the originals from every part.
- [ ] **Step 3: Run the full suite and commit.**
```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm e2e
git commit -m "feat(taxonomy): claims name the part they made, full or partial"
```

---

## Appendix: new error copy

Add each code to `src/app/_lib/error-messages.ts` in the task that first throws it.

| Code | EN | TR |
|---|---|---|
| `company.kind_invalid` (changed) | Choose what your company makes. | Şirketinizin ne ürettiğini seçin. |
| `company.not_found` | That company no longer exists. | Bu firma artık yok. |
| `registration.legal_name_invalid` | Legal name must be 2–160 characters. | Ticari unvan 2–160 karakter olmalı. |
| `registration.tax_id_invalid` | Enter a valid tax number for your country. | Ülkeniz için geçerli bir vergi numarası girin. |
| `registration.registry_number_invalid` | Registry number must be 1–40 characters. | Sicil numarası 1–40 karakter olmalı. |
| `registration.mersis_invalid` | MERSİS number must be 16 digits. | MERSİS numarası 16 haneli olmalı. |
| `registration.lei_invalid` | Enter a valid 20-character LEI. | Geçerli, 20 karakterlik bir LEI girin. |
| `registration.nace_invalid` | Activity codes look like 13.20 or 13.20.01. | Faaliyet kodları 13.20 veya 13.20.01 biçiminde olmalı. |
| `registration.text_too_long` | Addresses can be up to 300 characters, other fields 120. | Adresler en fazla 300, diğer alanlar 120 karakter olabilir. |
| `registration.employees_invalid` | Choose an employee range. | Bir çalışan aralığı seçin. |
| `registration.certification_invalid` | Each certificate needs a type, a number of up to 60 characters and a valid date. | Her sertifika için tür, en fazla 60 karakterlik numara ve geçerli bir tarih gerekir. |
| `registration.locked` | These details can't be changed while they're under review or after a decision. | Bu bilgiler incelemedeyken veya karar verildikten sonra değiştirilemez. |
| `registration.incomplete` | Complete the missing items before you submit. | Göndermeden önce eksik bilgileri tamamlayın. |
| `registration.not_submitted` | This company isn't waiting for review. | Bu firma incelemede değil. |
| `registration.tax_id_taken` | Another company has already registered this tax number. Write to hello@xbul.io. | Bu vergi numarasıyla başka bir firma kayıtlı. hello@xbul.io adresine yazın. |
| `review.own_company` | Another admin must review your own company. | Kendi firmanızı başka bir yönetici incelemeli. |
| `review.note_invalid` | Add a note of up to 1000 characters. | En fazla 1000 karakterlik bir not ekleyin. |
| `document.kind_invalid` | Choose what kind of document this is. | Belgenin türünü seçin. |
| `document.too_many` | You can upload up to 10 documents. | En fazla 10 belge yükleyebilirsiniz. |
| `document.not_found` | That document no longer exists. | Bu belge artık yok. |
| `fabric.construction_invalid` | Choose woven, knitted or nonwoven. | Dokuma, örme veya dokusuz seçin. |
| `fabric.pattern_invalid` | Choose a pattern that fits the construction. | Yapıya uygun bir desen seçin. |
| `fabric.twill_invalid` | A twill needs its ratio and direction; other patterns have neither. | Dimi için oran ve yön gerekir; diğer desenlerde olmaz. |
| `fabric.fibre_invalid` | List 1–4 different fibres, each a whole percent. | 1–4 farklı lif girin, her biri tam sayı yüzde olsun. |
| `fabric.composition_total` | Fibre percentages must add up to 100. | Lif yüzdelerinin toplamı 100 olmalı. |
| `fabric.weight_invalid` | Weight must be 20–1500 g/m² (or the same in oz/yd²). | Gramaj 20–1500 g/m² (veya oz/yd² karşılığı) olmalı. |
| `fabric.width_invalid` | Width must be 30–400 cm. | En 30–400 cm olmalı. |
| `fabric.dye_invalid` | Choose a dyeing method from the list. | Listeden bir boyama yöntemi seçin. |
| `fabric.finish_invalid` | Choose finishes from the list. | Apreleri listeden seçin. |
| `product.type_invalid` | Choose a product type from the list. | Listeden bir ürün türü seçin. |
