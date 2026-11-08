# Manufacturer registration, review and product classification: design

**Date:** 2026-11-07 · **Status:** draft for review
**Builds on:** `docs/superpowers/specs/2026-10-25-xmanufacture-design.md` (section 11 overrides the earlier sections there)
**Plan:** `docs/superpowers/plans/2026-11-07-manufacturer-registration.md`

## 1. What this adds

1. **Registration with validation data.** A company that registers as a manufacturer gives its legal identity, its production facility, its activity codes and supporting documents. What it is asked for depends on its country: Turkey first, then the EU and the Middle East.
2. **Automatic third-party checks.** When it submits, the platform runs the checks it can run without a paid contract or a CAPTCHA and shows the results to the admin.
3. **Admin review.** An admin approves, rejects, edits, or asks for more information. Nothing the company publishes is public until it is approved.
4. **Roles you can switch between.** One account can be a searcher, a manufacturer and an admin at the same time, and switches between those modes from the header.
5. **Classified products.** Each product a manufacturer links says what it made: the full product, or one part of it (for example the fabric only). It uses standard types: an HS code for the product, standard fibre names and codes with Latin names for natural fibres, and sector terms for the fabric (weave, twill, weight, dyeing).

## 2. Decisions

These were made by Claude. The user can override any of them.

- **Roles.** Anyone who is signed in can search. Anyone who owns a company is a manufacturer, whatever its review status. An admin is anyone whose email is in `ADMIN_EMAILS`. There is no admin table and no admin-management UI; add those once there are more than about three admins.
- **Mode is display only.** The `xb_mode` cookie decides which navigation the header shows (search, manufacturer or admin) and where the user lands. It never grants anything: every admin page and action still checks `ADMIN_EMAILS`, and every manufacturer action still checks company ownership. A cookie naming a mode the user doesn't hold is ignored.
- **Not public until approved.** A new company starts as `draft`. Its company page, article pages and claims are visible only to its owner and to admins until it is `approved`. That includes product pages, product tiles and counts, search matches, the sitemap and the stats. It can still add products while it waits.
- **Existing suppliers are grandfathered.** The migration marks every company that already exists as `approved`, so the live site doesn't change. An admin can still ask any of them for details later.
- **One legal entity, one company.** If another company that is submitted, waiting for changes or approved already uses the same tax number in the same country, submission is refused.
- **Review states:** `draft → submitted → approved | rejected | changes_requested`, and `changes_requested → submitted` again.
  - Rejecting is final for that company. The person can ask questions by email, since platform support is by email.
  - An admin can also reject an approved company. This withdraws the approval when fraud turns up later.
- **The owner can edit legal details only in `draft` and `changes_requested`.** Once a company is approved, its legal details are locked. Changes go through an admin edit, which is recorded. Contact details stay freely editable, as they are today.
- **No self-review.** An admin can't approve, reject or ask for changes on a company they own.
- **The review history is kept for good.** Every submission, decision and admin edit is logged, with who did it, when, the note, and for edits the before and after values.
- **Documents are deleted after the decision.** They are kept while a company is `submitted` or `changes_requested`, and deleted once it is `approved` or `rejected`. This is the same rule as claim evidence, because signature circulars and tax certificates carry personal data (KVKK and GDPR data minimisation). The log keeps which document kinds and file names were reviewed.
- **Automatic checks** use only free, keyless sources: local checksum and format rules, EU VIES, and GLEIF.
  - Turkish registries have no public API: GİB's institutional service needs a protocol, and e-Devlet and TTSG need a login or CAPTCHA. So for Turkey the admin checks documents by hand, using links the admin page provides.
  - Paid vendors come later, behind the same `RegistryChecker` port (section 6).
- **One company, one main part.** A company still picks one kind at onboarding. The kind decides the part its claims count for, as today. The list of kinds grows from 2 to 7 (section 9.1).
- **Code names stay.** The claim scope value `garment` means "finished product (full)". Existing table and column names are not renamed.
- **Taxonomy is data in the code.** Parts, fibres, fabric terms and product types live as typed constants in `src/shared/domain/taxonomy/`. Another industry is added by adding data, not by building an admin editor.

## 3. What a manufacturer gives

| Field | Turkey | EU | Middle East / other | Required to submit |
|---|---|---|---|---|
| Legal name | Ticaret unvanı, as on the vergi levhası | Registered name | Registered name | yes |
| Tax number | VKN, 10 digits with checksum; or TCKN, 11 digits, for a sole proprietor (şahıs firması) | VAT number with the country prefix, checked by VIES | AE: TRN; SA: VAT number (15 digits, starting and ending with 3); IL: company number; other countries: their tax ID | yes |
| Tax office | Vergi dairesi | n/a | n/a | no |
| Registry number | Ticaret sicil no, or esnaf sicil no | Company-register number (HRB, SIREN, KvK, KRS…) | Commercial registration number (CR, trade licence) | yes |
| MERSİS no | 16 digits; for companies it contains the VKN | n/a | n/a | no |
| Industrial registry no | Sanayi sicil no | n/a | n/a | no |
| LEI | optional | optional | optional | no |
| Registered address | from the vergi levhası | from the register | from the register | yes |
| Production facility address | where production happens | same | same | yes |
| Activity codes | NACE: 6 digits on the vergi levhası (13.20.01), 4 digits on the faaliyet belgesi (13.20) | NACE Rev.2 | NACE or ISIC equivalent | at least one in section C (divisions 10–33) |
| Employees | 1–9 · 10–49 · 50–249 · 250+ | same | same | no |
| Monthly capacity | Free text in the sector's units (`300,000 m`, `40,000 pcs`) | same | same | no |
| Certifications | Scheme, certificate number and valid-until date. Up to 10, from: OEKO-TEX 100, GOTS, OCS, GRS, RCS, bluesign, ISO 9001, ISO 14001, amfori BSCI, SMETA, WRAP, other | same | same | no |
| Open Supply Hub ID | optional | optional | optional | no |

## 4. Documents

PDF, JPG or PNG, up to 10 MB each and 10 files per company. They are stored privately and only the owner and admins can download them.

| Kind (`DocumentKind`) | Turkey | Elsewhere |
|---|---|---|
| `tax_certificate` | Vergi levhası (e-levha with its onay kodu) | VAT registration certificate |
| `registry_extract` | Faaliyet belgesi / oda kayıt belgesi (barcoded), or the TTSG notice | Register extract (Handelsregisterauszug, Kbis, KvK uittreksel…) |
| `signature_circular` | İmza sirküleri | Proof of authority to sign |
| `industry_registry` | Sanayi Sicil Belgesi (PDF with a QR code) | Industrial or manufacturing licence |
| `capacity_report` | Kapasite Raporu (TOBB-approved, valid about 2 years) | Factory audit or capacity statement |
| `certificate` | OEKO-TEX, GOTS, GRS or ISO certificate | same |
| `facility_photo` | Photos of the production floor | same |
| `other` | anything else | anything else |

**Required to submit.** Each row is a group: at least one document from each group.

- **Turkey:** [`tax_certificate`] · [`registry_extract`] · [`industry_registry` or `capacity_report`]
- **Everywhere else:** [`registry_extract`] · [`industry_registry`, `capacity_report`, `facility_photo` or `certificate`]

## 5. How each item is checked

| Check | How | Outcome |
|---|---|---|
| `tax_id_format` | The VKN checksum, applied right to left, from python-stdnum (`stdnum/tr/vkn.py`). The TCKN checksum. EU VAT format per country. SA and AE formats. | pass / fail |
| `mersis_matches_tax_id` | For a 10-digit VKN, digits 2–11 of the MERSİS number equal the VKN. The pattern is only documented by third parties, so a mismatch is `unknown`, never `fail`. | pass / unknown |
| `nace_manufacturing` | At least one activity code in divisions 10–33 | pass / fail |
| `email_domain` | The domain of the sign-in email and the website's host (without `www.`) are equal, or one is a subdomain of the other. A free-mail address, a domain that differs, or no website gives `unknown`. | pass / unknown |
| `eu_vies` | `GET https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{MS}/vat/{number}` returns `{ isValid, userError, name, address }`. Greece's member-state code is `EL` and Northern Ireland's is `XI`. | `isValid` with a matching name gives pass; `isValid` with a different name gives unknown; `INVALID` gives fail; `MS_UNAVAILABLE`, a timeout or a 5xx gives unknown |
| `gleif` | With an LEI: `GET https://api.gleif.org/api/v1/lei-records/{LEI}`. Without one: `GET https://api.gleif.org/api/v1/lei-records?filter[fulltext]={name}&filter[entity.legalAddress.country]={CC}&page[size]=5` | An LEI that is `ACTIVE` and `ISSUED`, with a matching name and country, gives pass. An LEI that doesn't exist gives fail. A name search with no match is not applicable (most small firms have no LEI). |
| Turkish documents | **Manual.** e-Devlet barcode check at https://www.turkiye.gov.tr/belge-dogrulama; GİB document checks at https://dijital.gib.gov.tr/; TTSG at https://www.ticaretsicil.gov.tr/. The admin confirms that the VKN, legal name and address agree across all documents and that the NACE code is in section C. | admin decision |
| Certificates | **Manual.** GOTS at https://www.global-standard.org/find-suppliers-shops-and-inputs; Textile Exchange (GRS, RCS, OCS) at https://textileexchange.org/find-certified-company/; OEKO-TEX Label Check at https://www.oeko-tex.com/en/label-check | admin decision |
| Open Supply Hub | **Manual.** `https://opensupplyhub.org/facilities/{osId}`. The API is paid (from $225 a month). | admin decision |

**How a name match works (`legalNameMatches`).** Both names go through these steps:
1. Lower-case them.
2. Strip diacritics and map `ı` to `i`.
3. Replace everything that isn't a letter or a digit with a space.
4. Drop one-letter tokens and legal-form words (section 9.6).

Two names match when they leave the same set of tokens, or when the smaller set has at least 2 tokens and all of them are in the larger set.

## 6. Third-party options: now and later

| Use now (free) | Add later, when volume justifies it |
|---|---|
| VIES, GLEIF, local checksums | **Turkish registry data:** KnowYourCustomer.com (covers Turkey live from TTSG/TOBB, has a sandbox) or Creditsafe (covers Turkey, sales-led) |
| Manual links to e-Devlet, GİB, TTSG, GOTS, Textile Exchange, OEKO-TEX | **Wider KYB:** OpenCorporates (from £2,250 a year), Sumsub, Trulioo, Kyckr (EU + UK) |
| | **GİB institutional VKN service:** needs a protocol; 0.35 TL per VKN check and 1 TL per levha |
| | **UK Companies House API** (free key), **INSEE Sirene** (free key), **KvK** (€6.20 a month per key plus €0.02 per profile): add when the first company from that country registers |
| | **Sanctions screening:** ComplyAdvantage (ComplyLaunch is free for startups) |
| | **Open Supply Hub API** (from $225 a month); **IAF CertSearch** for ISO certificates (paid per credit) |

Each later source is one more `RegistryChecker`: `(subject) => Promise<CheckResult | null>`.

## 7. Review workflow

```
            owner saves (any number of times)
draft ───────────────────────────────┐
  │ owner submits (nothing missing,  │
  │ tax number not already taken)    │
  ▼                                  │
submitted ──admin: ask for changes──▶ changes_requested ──owner submits──▶ submitted
  │   │
  │   └──admin: reject (note) ──▶ rejected   (an approved company can be rejected too)
  └──admin: approve ──▶ approved
admin edit: allowed in any state; changes no state; logged as "edited" with before and after values
```

**After each event:**
- **Submitted:** automatic checks run in the background. Every admin gets an email: "New manufacturer to review: {name}", with the review link.
- **Approved:** the owner gets an email in English and Turkish with a link to the company page. The documents are deleted.
- **Changes requested:** the owner gets an email with the admin's note and a link to the registration page. The documents are kept.
- **Rejected:** the owner gets an email with the note and "Questions: hello@xbul.io". The documents are deleted.
- If an email fails, the error is logged and the decision still stands.

**What the owner sees on the registration page:**

| Status | Banner |
|---|---|
| `draft` | Not public yet. Complete the details and submit them for review. |
| `submitted` | Under review. We'll email you when it's decided. |
| `changes_requested` | We need more information: {note} |
| `approved` | Approved. Your company and products are public. |
| `rejected` | Not approved: {note}. Questions: hello@xbul.io |

## 8. Roles and modes

| Mode | Who has it | Home | Navigation |
|---|---|---|---|
| `search` | every signed-in user | `/` | Brands |
| `manufacturer` | every signed-in user. Without a company it leads to registration. | `/m/{slug}`, or `/onboarding` | My company, Add products, Registration; or "Register your company" |
| `admin` | `ADMIN_EMAILS` | `/admin/manufacturers` | Manufacturers, Claims, Stats |

**Which mode applies when there is no valid cookie:** `manufacturer` if the user has a company, otherwise `admin` if they are an admin, otherwise `search`.

**Sign-in still lands on `/onboarding`.**
- A user with a company goes to `/add` once approved, or to their registration page before that.
- A user who chose a mode other than manufacturer goes to that mode's home.
- Everyone else sees "Only searching? Search manufacturers" above the registration form.

## 9. Product classification

**Three things are recorded:**
- **On the brand product:** what the end product is. For example jeans, `HS 6203.42 / 6204.62`.
- **On each claim:** which part of it the company made, and so whether that was the full product or partial.
- **On the company's own product code** (its article): the fabric's technical sheet in sector terms, with the HS code derived from it where the rules below allow.

**Example: a mill that made only the fabric of a pair of GUESS jeans.** The product reads "Jeans · HS 6203.42 / 6204.62". Indigo Mill's claim reads "Partial · Fabric". Its code 60219/1 shows these chips:
- Woven · 3/1 right-hand twill (RHT)
- Denim
- 98% Cotton (CO, *Gossypium* spp.) · 2% Elastane (EL)
- 424 g/m² (12.5 oz/yd²)
- 150 cm wide
- Rope-dyed
- Sanforized
- HS 5209.42

### 9.1 Parts (`PartId`) and company kinds

| PartId | Full product? | Label EN / TR | Company kind | Onboarding option EN / TR |
|---|---|---|---|---|
| `garment` | yes | Finished product / Bitmiş ürün | `garment_maker` | We make garments (finished product) / Hazır giyim üretiyoruz (bitmiş ürün) |
| `fabric` | no | Fabric / Kumaş | `fabric_mill` | We make fabric / Kumaş üretiyoruz |
| `yarn` | no | Yarn / İplik | `yarn_spinner` | We spin yarn / İplik üretiyoruz |
| `trims` | no | Trims and accessories / Aksesuar | `trims_maker` | We make trims (buttons, zips, labels) / Aksesuar üretiyoruz (düğme, fermuar, etiket) |
| `sewing` | no | Cut, make and trim (CMT) / Fason kesim-dikim | `sewing_contractor` | We cut and sew for others (CMT) / Fason kesim-dikim yapıyoruz |
| `washing` | no | Washing and finishing / Yıkama ve apre | `laundry` | We wash and finish garments / Yıkama ve apre yapıyoruz |
| `printing` | no | Printing and embroidery / Baskı ve nakış | `print_house` | We print and embroider / Baskı ve nakış yapıyoruz |

On the product page, the badge reads "Full product" / "Tam ürün" when `full` is yes, and otherwise "Partial · {label}" / "Kısmi · {label}".

### 9.2 Fibres (`FibreCode`)

The codes are BISFA abbreviations as used on EU labels. Names follow ISO 2076 and EU Regulation 1007/2011.

| Code | EN | TR | Generic name | Latin name | Group |
|---|---|---|---|---|---|
| CO | Cotton | Pamuk | cotton | *Gossypium* spp. | natural |
| LI | Linen | Keten | flax | *Linum usitatissimum* | natural |
| HA | Hemp | Kenevir | hemp | *Cannabis sativa* | natural |
| WO | Wool | Yün | wool | *Ovis aries* | natural |
| WS | Cashmere | Kaşmir | cashmere | *Capra hircus* | natural |
| SE | Silk | İpek | silk | *Bombyx mori* | natural |
| VI | Viscose | Viskon | viscose | — | man_made |
| CMD | Modal | Modal | modal | — | man_made |
| CLY | Lyocell | Lyosel | lyocell | — | man_made |
| CUP | Cupro | Kupro | cupro | — | man_made |
| CA | Acetate | Asetat | acetate | — | man_made |
| PES | Polyester | Polyester | polyester | — | man_made |
| PA | Polyamide (nylon) | Poliamid (naylon) | polyamide | — | man_made |
| PAN | Acrylic | Akrilik | acrylic | — | man_made |
| PP | Polypropylene | Polipropilen | polypropylene | — | man_made |
| EL | Elastane | Elastan | elastane | — | man_made |

**Accepted aliases** (case-insensitive): `EA` → `EL`, `PL` → `PES`, `NY` → `PA`. `PE` is not an alias, because it means polyethylene.

**Composition rules:**
- 1 to 4 fibres, with no code repeated.
- Each fibre is a whole percent from 1 to 100.
- The percentages add up to exactly 100.

### 9.3 Fabric terms

| Group | id: EN / TR |
|---|---|
| Construction | `woven`: Woven / Dokuma · `knitted`: Knitted / Örme · `nonwoven`: Nonwoven / Dokusuz |
| Woven patterns | `plain`: Plain weave / Bezayağı · `twill`: Twill / Dimi · `satin`: Satin / Saten · `dobby`: Dobby / Armürlü · `jacquard`: Jacquard / Jakarlı · `other`: Other / Diğer |
| Knitted patterns | `single_jersey`: Single jersey / Süprem · `interlock`: Interlock / İnterlok · `rib`: Rib / Ribana · `pique`: Piqué / Lakost · `fleece`: Fleece (3-thread) / Üç iplik · `french_terry`: French terry (2-thread) / İki iplik · `jacquard_knit`: Knit jacquard / Örme jakar · `other` |
| Nonwoven patterns | `other` only |
| Twill ratio (twill only, required) | `2/1` · `3/1` · `2/2` |
| Twill direction (twill only, required) | `rht`: right-hand twill (RHT) / sağ dimi (RHT) · `lht`: left-hand twill (LHT) / sol dimi (LHT) · `broken`: broken twill / kırık dimi |
| Dyeing | `rope`: Rope-dyed / Halat boyama · `slasher`: Slasher-dyed / Slasher boyama · `yarn_dyed`: Yarn-dyed / İplik boyalı · `piece_dyed`: Piece-dyed / Parça boyalı · `garment_dyed`: Garment-dyed / Konfeksiyon boyalı · `undyed`: Undyed (greige) / Ham |
| Finishes (several allowed) | `sanforized`: Sanforized / Sanforlu · `mercerized`: Mercerized / Merserize · `coated`: Coated / Kaplamalı · `brushed`: Brushed / Şardonlu · `water_repellent`: Water-repellent / Su itici |
| Weight | Entered in g/m² or oz/yd² and stored as whole g/m², from 20 to 1500. 1 oz/yd² = 33.906 g/m². |
| Width | Whole cm, from 30 to 400, optional |

**Denim** (from the HS Chapter 52 subheading note: a warp-faced 3- or 4-thread twill whose warp is dyed) means all of these together:
- construction `woven`
- pattern `twill`
- ratio `2/1` or `3/1`, in any direction
- dyeing `rope` or `slasher`

### 9.4 HS code for a fabric

The rule covers cotton woven fabrics only (Chapter 52). For anything else the code is `null`, and the page shows none.

1. If the fabric is not woven, or cotton is not strictly the largest single fibre, the result is `null`.
2. If cotton is 85% or more: up to 200 g/m² gives `5208`; over 200 g/m² gives `5209`, or `5209.42` if it is denim.
3. If cotton is under 85% and the man-made share (section 9.2 group) is larger than the share of the other natural fibres: up to 200 g/m² gives `5210`; over 200 g/m² gives `5211`, or `5211.42` if it is denim.
4. Otherwise the result is `5212`.

### 9.5 Product types (`ProductTypeId`) with HS codes

The codes are for woven garments, except for t-shirts and knit tops.

| id | EN / TR | HS | Guess pattern, applied in this order to the folded name |
|---|---|---|---|
| `t_shirt` | T-shirt / Tişört | 6109 | `\b(t ?shirts?\|tees?\|tisort)\b` |
| `suit` | Suit / Takım elbise | 6203.1, 6204.1 | `\b(suits?\|takim elbise)\b` |
| `dress` | Dress / Elbise | 6204.4 | `\b(dress(es)?\|elbise)\b` |
| `jacket` | Jacket or blazer / Ceket | 6203.3, 6204.3 | `\b(jackets?\|blazers?\|ceket)\b` |
| `coat` | Coat / Mont, kaban | 6201, 6202 | `\b(coats?\|parkas?\|trench\|anoraks?\|mont\|kaban)\b` |
| `skirt` | Skirt / Etek | 6204.5 | `\b(skirts?\|etek)\b` |
| `shorts` | Shorts / Şort | 6203.4, 6204.6 | `\b(shorts\|sort)\b` |
| `jeans` | Jeans / Kot pantolon | 6203.42, 6204.62 | `\b(jeans?\|kot)\b` |
| `trousers` | Trousers / Pantolon | 6203.4, 6204.6 | `\b(trousers?\|pants?\|chinos?\|pantolon)\b` |
| `shirt` | Shirt or blouse / Gömlek, bluz | 6205, 6206 | `\b(shirts?\|overshirts?\|blouses?\|gomlek\|bluz)\b` |
| `knit_top` | Sweater or sweatshirt / Kazak, sweatshirt | 6110 | `\b(sweaters?\|jumpers?\|pullovers?\|sweatshirts?\|hoodies?\|cardigans?\|kazak\|hirka)\b` |

**Folding a name before matching:**
1. `toLowerCase()`.
2. NFKD, with combining marks removed.
3. `ı` becomes `i`.
4. `-` becomes a space.

The first pattern that matches wins. If none matches, the type is `null` and the supplier picks one.

### 9.6 Legal-form words dropped when comparing names

```
anonim sirketi sirket as ltd limited sti san sanayi sanayii tic ticaret ve ith ihr ithalat ihracat paz pazarlama
gmbh mbh ag kg co sa sas sarl srl spa bv nv plc llc inc corp company the and fze fzco fzc wll ltda sp zoo oy ab kft doo
```

## 10. Not in this phase

- Paid KYB vendors, sanctions screening and the Open Supply Hub API (section 6).
- Expiry reminders, for capacity reports and certificates.
- Team members on a company.
- More than one company per user.
- A UI to manage admins.
- Admin overrides for a product type that the first supplier set wrongly.
- Structured technical sheets for yarn, trims and the other non-fabric parts. They keep the free-text specs.
- Industries other than apparel and textiles, which are added as data.
- Paid badges.

## 11. Open questions for the operator

- Must existing suppliers re-register? They are grandfathered as approved for now.
- Is "rejected" really final, or should a rejected company be able to fix its details and resubmit?
- Should approved companies show a public "Verified manufacturer" badge, and should it be the paid badge from section 11 of the earlier design?
