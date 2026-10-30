# xmanufacture — Design

**Date:** 2026-10-25 · **Status:** draft for review
**Mockups:** `docs/design/mockup-pages-v1.html` (open in a browser; tabs at the top switch pages)

## 1. Intent

The idea comes from a textile mill (the user's brother, denim / indigo). The mill team already works like this today: someone spots a brand garment made from the mill's fabric (Guess, Liu-Jo, Emporio Armani…), takes a phone screenshot, and posts it in a chat group with the mill's own article code (`60219/1`, `60409/1`, `EArmani 60450/1`). Sales agents then use those screenshots to pitch the fabric to other brands.

xmanufacture turns that habit into a product:

- **A link instead of a screenshot.** The mill pastes the brand's product link and types the article code. That is all the data entry there is.
- **A page per garment.** The page shows who made the fabric (the *original* mill) and which mills can make an *equivalent* (muadil).
- **A page per article.** For example, "60219/1 is in these Guess and Liu-Jo pieces right now". It's a ready-made sales page that agents can forward.
- **Direct requests.** A buyer asks for a swatch or a quote from the page itself. The request goes to the mill, and the agent who shared the link is credited.

It is a B2B **sales and discovery** platform. It is **not** a traceability or Digital Product Passport tool. The brother explicitly moved away from traceability.

## 2. Users

| Role | Who | Account in Phase 1 |
|---|---|---|
| Mill member | Someone at a fabric mill who adds garments and answers requests | Yes (magic link), owns exactly one Company |
| Agent | A sales agent representing mills to brands, earning commission | Yes (magic link); gets a personal handle used in share links |
| Buyer | Brand fabric buyer, designer, or sourcing manager | **No.** Fills a short form per request |
| Admin | The platform team | Yes; email listed in `ADMIN_EMAILS` |

## 3. Core flows (Phase 1)

1. **Add garments (mill).** Paste 1–50 brand product links, one per line. For each link the system fetches the photo, brand, name and composition. The mill types an article code (optional) and picks **Our fabric** or **Equivalent** for each row, then publishes. If a site blocks the fetch, that row asks for brand and name by hand. It never blocks publishing.
2. **Share.** Every garment page and article page has a stable URL with a rich link preview (Open Graph title and image) for WhatsApp and WeChat. Signed-in agents copy links that carry `?via=<handle>`.
3. **Request.** On a garment or article page, a buyer clicks **Request swatch** (on the original) or **Request quote** (on an equivalent). The form asks for name, email, company, quantity in metres and a message. The mill owner gets an email, and the request appears in the mill's **Requests** inbox, credited to the agent from `?via=` if the handle exists.
4. **Discover.** On the home page, a visitor pastes any garment link. If it's tagged, they go to its garment page. If not, they see "not tagged yet" with a prompt for mills. Below that is a grid of recently tagged garments.
5. **Verify.** Mills *declare* claims. An admin marks an *original* claim as **verified** after checking proof off-platform (proof upload comes in Phase 2). A garment can have at most one verified original.

## 4. Decisions

**Decided by the user and the brother:**
- It's a sales and discovery platform, not traceability.
- There's no data entry beyond a link and an article code. No catalogue uploads and no photo uploads.
- The garment page lists the original mill at the top, then the mills offering equivalents.
- **The platform is neutral.** Competitors' "equivalent" offers appear under a garment even when another mill is the original. (The user answered for the brother; confirm with him.)
- The stack is TypeScript with "the best framework", following DDD and clean code.
- The visual design follows https://garm.framer.website/.

**Decided by Claude (each one can be overridden):**
- **Stack:** Next.js 16 (App Router) as one app, structured as a modular monolith. PostgreSQL with Drizzle ORM. Better Auth for magic-link sign-in. Resend for email. Production runs on Cloudflare Workers via OpenNext, with Neon Postgres reached through Hyperdrive. Local development and tests use PGlite, so no Docker is needed.
- **Fabric mills only in Phase 1.** Garment makers (konfeksiyon) come in Phase 2.
- **The UI is English only in Phase 1.** Copy lives in components in plain case, and CSS makes it uppercase.
- **Buyers don't sign up.**
- **Product photos are hotlinked** from the brand's own image URL. We never download or re-host them, and each one is credited "PHOTO: GUESS.EU ↗" linking back to the source.
- **The article page only shows that mill's own garments,** so competitors never appear on a mill's own pages. They only appear on a garment page.
- **Agent credit comes from `?via=` on the page the buyer lands on.** It is not carried through further navigation.
- **One mill account owns one Company.** Team invites come in Phase 2.
- **Article codes create the Article automatically** the first time they're typed in the Add flow. The mill fills in specs (weight, composition, finish, MOQ, lead time) later on the article page.
- **One claim per (garment, mill).** Re-publishing the same garment updates that mill's claim.
- **Equivalents are ordered by when they were posted** (oldest first). There's no ranking algorithm in Phase 1.

## 5. Domain model (ubiquitous language)

| Context | Aggregate / concept | Key fields and rules |
|---|---|---|
| **Catalog** | **Product**: a garment on sale on a brand's site | `canonicalUrl` (unique), `sourceUrl`, `brand`, `name`, `imageUrl?`, `composition?`. The URL is canonicalized to https, with no `www.`, no tracking parameters, no hash and no trailing slash. |
| **Supplier** | **Company**: a fabric mill. **Article**: one of its fabrics. | Company: `slug` (unique), `name`, `city`, `country` (ISO-2), `ownerUserId`. Article: `code` normalized (trimmed, single spaces, uppercase), unique per company, URL `slug`. Specs are optional: `weightOz`, `composition`, `finish`, `moqMeters`, `leadTimeWeeks`. |
| **Claims** | **Claim**: links a Company (and optionally an Article) to a Product | `kind`: `original` or `equivalent`. `status`: `declared` or `verified`. `note` is up to 280 characters. One per (product, company). Only originals can be verified, and there is at most one verified original per product. Display order: verified original, then declared originals, then equivalents, each oldest first. |
| **Inquiry** | **Inquiry**: a buyer's request to a Company | `kind`: `swatch` or `quote`. Has a buyer name, email and company, an optional `quantityMeters` and an optional message up to 2000 characters. Targets a product or an article. `viaAgentHandle` must be an agent that exists. `status`: `new` or `answered`. Rate limit: 5 per buyer email per company per 24h. |
| **Identity** | **Profile**: the role attached to an authenticated user | `role`: `mill` or `agent`. Agents get a unique `handle`. Admin is decided by the email allowlist, not a role. Authentication is handled by Better Auth. |
| **Discovery** | Read models only, with no aggregates | The garment page view, article page view, mill page view, recently tagged garments, and declared originals waiting for admin review. |

**Architecture rules**
- Each context lives in `src/modules/<context>/` with `domain/` (pure TypeScript), `application/` (use cases) and `infrastructure/` (Drizzle, HTTP, email), plus a public `index.ts`.
- `domain/` imports nothing from Next.js, React, Drizzle, Better Auth or other modules.
- Code outside a module imports only that module's `index.ts`. The one exception is `infrastructure/schema.ts`, which `discovery` and `src/server/` may import to build read models and wire the database.
- `src/app/` (Next.js) is the presentation layer. `src/server/container.ts` is the composition root.
- Any write scoped to a company takes the company from the signed-in viewer on the server, never from form input.

## 6. Pages

| Route | Who | Content (see the mockup) |
|---|---|---|
| `/` | everyone | Hero "Who made this fabric?" with a paste-a-link search box, then a grid of recently tagged garments |
| `/p/[id]` | everyone | Garment page: brand photo, brand, name, composition and source link. Original mill block with article chips and **Request swatch**. Equivalents list with **Request quote**. A "Shared by agent" banner when `?via=` is valid. |
| `/m/[company]` | everyone | Mill page: name, city, its articles and garments |
| `/m/[company]/a/[article]` | everyone | Article page: big code, spec strip, grid of this mill's garments, **Request swatch**, **Copy link for agents**. The owner can edit specs. |
| `/add` | mill | Paste links, then preview rows (photo, brand and name, article code, Our fabric / Equivalent), then **Publish N garments** |
| `/requests` | mill | Inbox of requests (new first) with a "mark answered" action. The nav shows a count of new requests. |
| `/sign-in` | everyone | Email box for a magic link |
| `/onboarding` | newly signed-in user | Choose "I'm at a mill" (company name, city, country) or "I'm an agent" (display name) |
| `/admin/claims` | admin | Declared original claims, each with a **Verify** button |

## 7. Visual design (Garm style)

- **Font:** Space Grotesk (400/500/600/700), loaded with `next/font/google`.
- **Colours:** ink `#000000`, paper `#FFFFFF`, accent `#F0721F` (main button, counts, "original" tags), muted `#707070`.
- **Lines and corners:** 1px solid black lines between every band and around grid tiles. No rounded corners and no shadows.
- **Text:** UI text is uppercase, mostly 11–13px. Display headings are large and bold with tight letter-spacing.
- **Page furniture:** a scrolling ticker bar, a header with the wordmark on the left and a live "ISTANBUL, TR" clock on the right, and a nav row with thin lines above and below.
- **Grid:** 3 columns of 4:5 image tiles, with a caption bar under each (label on the left, tag on the right). It drops to 2 columns below 760px.
- **Garment page:** follows Garm's product page. Photos on the left, a detail panel on the right, and the layout stacks on mobile.
- Garm itself is a Framer template made by Branditecture. We copy the style and **none** of its assets, logo or text.

## 8. Goals, non-goals, anti-goals

**Phase 1 goals:** the brother's mill can replace screenshots with links in under a minute per batch. A buyer can get from a forwarded link to a swatch request in under a minute. Agents are credited on every request that came through their link.

**Non-goals for Phase 1:** payments and subscriptions; visual (AI) search; uploading proof for verification; garment makers; team invites; Turkish UI; buyer accounts; in-app messaging (the mill replies by email); a browser extension; a WhatsApp bot; analytics dashboards.

**Anti-goals** (failure even if everything technically works):
- Mills have to fill in long forms or upload catalogues.
- Agents get cut out, with no attribution.
- Brand photos are re-hosted on our site.
- A mill's relationship with a brand is exposed without that mill choosing to publish it. Everything is opt-in by the mill.

## 9. Risks

- **NDAs.** Some mills can't publicly say "we supply Guess". Mitigation: publishing is the mill's own action, and an "equivalent" claim needs no relationship with the brand.
- **Brand sites block fetching.** Mitigation: brand and name can be entered by hand. A fallback through a scraping service is Phase 2.
- **Fake "original" claims.** Mitigation: they show as declared and visibly differ from verified ones, and an admin verifies them.
- **Two-sided cold start.** Mitigation: the product is useful to a single mill and its agents from the first garment (share links), before any buyer arrives through search.

## 10. Roadmap

- **Phase 1 (this design, one plan):** capture, share, request, basic discovery and admin verification, deployed to Cloudflare.
- **Phase 2:** proof upload for verification, team members, Turkish UI, garment makers, browse by brand and category, a fallback for blocked sites, sharing from the phone (PWA share target) or a Chrome extension.
- **Phase 3:** revenue (mill subscription, paid visibility, fees per request), visual search, and analytics for mills (views and requests per article).

## 11. The brother's answers (received 2026-10-30)

These override earlier sections where they conflict. The code doesn't reflect the "Changes" list yet.

**Confirmed, no change needed**
- **Neutral listing stays.** Some suppliers may object to competitors under their products, but most won't.
- **Publishing is the supplier's call.** Whether to name a brand is up to each supplier, not the platform. No private-link mode is needed.
- **Specs stay optional.** Suppliers enter them if they want to.
- **No commission** runs through the platform.

**Changes to the product**
- **Garment makers (konfeksiyon) are needed from the start,** not in Phase 2.
- **Beyond clothing and beyond Turkey.** Clothing comes first, but the model must extend to all industrial products, on a global marketplace. Domain language and copy shouldn't assume fabric, denim or Turkey.
- **Verified means evidence.** A supplier who wants the badge submits invoices and correspondence with the customer to the platform team.
- **Buyers have three levels.** Anyone can search without signing up. A free member also sees suppliers' current listings and ratings. A paying member gets detailed supplier information.
- **Revenue.** Buyers pay a monthly subscription for supplier detail. Suppliers pay to rank higher among equivalents, and pay for the verified badge. This replaces the Phase 3 revenue idea in section 10.
- **Platform support is by email,** for technical questions to the platform team. The brother speaks as the platform's operator, not as a user of it.

**Success after the first month:** 20–30 suppliers have added 200–300 products, and 10–20 customers have searched. The app doesn't record searches yet, so this can't be measured today.

**First suppliers to invite:** garment makers Taypa and Fashionpoint; mills Indigo Tunel and EGR.

**Second round of answers (2026-10-30)**
- **No agents.** "Agent" came from an early draft; forget it. The agent role, handles and `?via=` credit go. This overrides the agent parts of sections 2, 3, 5, 6 and 8.
- **No request form.** Buyers reach the supplier directly through the supplier's contact details, and the platform doesn't relay anything. The Inquiry context, the Requests inbox and request emails go. This overrides flow 3 in section 3 and the Inquiry row in section 5.
- **Ratings:** customers rate their experience with a supplier. This needs buyer accounts, so it comes with them.
- **The name** "xmanufacture" stays for now and changes later.

**Decided by Claude for the next phase (each can be overridden)**
- **Contact details are public** with no account needed, because the brother said buyers should reach the manufacturer directly. A supplier gives at least one of email, phone or website at onboarding and can edit them.
- **One kind per company:** a company is either a fabric mill or a garment maker. A firm that does both picks one for now.
- **A garment page has two lists:** who made the fabric and who made the garment. Each list follows the existing order (verified original, declared originals, equivalents), and each can have one verified original.
- **Specs become free text** except lead time, so a supplier writes "1,000 m" or "12.5 oz" or "240 g/m²" in their own units.
- **Copy says "supplier", not "mill",** and the home headline stops mentioning fabric. Code names for the existing tables and routes stay, to keep the change small.
- **The Istanbul clock is removed,** because the marketplace is global.
- **Evidence:** PDF, JPG or PNG, up to 5 files of 10 MB each, in private storage that only the owning supplier and admins can reach. An admin approves or rejects with a note. The files are deleted once decided, and the decision, who made it and when are kept, because invoices are sensitive and shouldn't be held longer than needed.
- **Searches:** each home search is counted with whether it matched, plus a salted daily hash of the visitor's IP so distinct visitors can be counted without storing an address. An admin stats page shows suppliers, products, searches and distinct searchers against the success target.
- **English only for now.** Turkish wasn't answered, so it stays in the next phase after this one.

**Not in this phase:** buyer accounts, ratings, the paid subscription, paid ranking, the paid badge, other industries' company kinds and a second language. The evidence flow is what the paid badge will later plug into.

**Open question:** whether Turkish is needed for launch.
