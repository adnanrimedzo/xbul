import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { createProduct, createProductRepository } from '@/modules/catalog';
import { createClaimRepository, declareClaim, verifyClaim, type ClaimKind } from '@/modules/claims';
import { user } from '@/modules/identity';
import { claimScopeOf, createArticle, createCompany, createSupplierRepositories, companies, withSpecs } from '@/modules/supplier';
import { DEMO } from './demo-ids';

const BASE = new Date('2026-01-01T09:00:00Z');
const at = (minutes: number) => new Date(BASE.getTime() + minutes * 60_000);

// Shared fixture for the discovery tests, `pnpm seed` and the e2e specs. Idempotent.
export async function seedDemo(db: Db): Promise<void> {
  const [existing] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, DEMO.companies.indigo)).limit(1);
  if (existing) return;

  const { companies: companyRepo, articles } = createSupplierRepositories(db);
  const productRepo = createProductRepository(db);
  const claimRepo = createClaimRepository(db);

  const people = [
    { key: 'mill', name: 'Indigo Mill' },
    { key: 'denizli', name: 'Denizli Indigo' },
    { key: 'bursa', name: 'Bursa Weave' },
    { key: 'maker', name: 'Anka Garments' },
  ] as const;
  await db.insert(user).values(
    people.map((p) => ({ id: DEMO.users[p.key], name: p.name, email: DEMO.emails[p.key], emailVerified: true, createdAt: BASE, updatedAt: BASE })),
  );

  const suppliers = [
    { key: 'indigo', owner: 'mill', kind: 'fabric_mill', name: 'Indigo Mill', city: 'Istanbul', website: 'https://indigo-mill.example' },
    { key: 'denizli', owner: 'denizli', kind: 'fabric_mill', name: 'Denizli Indigo', city: 'Denizli', website: null },
    { key: 'bursa', owner: 'bursa', kind: 'fabric_mill', name: 'Bursa Weave', city: 'Bursa', website: null },
    { key: 'anka', owner: 'maker', kind: 'garment_maker', name: 'Anka Garments', city: 'Istanbul', website: null },
  ] as const;
  for (const m of suppliers) {
    const ownerUserId = DEMO.users[m.owner];
    const contact = { email: `sales@${DEMO.companySlugs[m.key]}.example`, website: m.website };
    const company = createCompany({ name: m.name, city: m.city, country: 'TR', ownerUserId, contact, kind: m.kind }, BASE);
    await companyRepo.save({ ...company, id: DEMO.companies[m.key] });
  }

  const a60219 = withSpecs(createArticle({ companyId: DEMO.companies.indigo, code: '60219/1' }, BASE), {
    weight: '12.5 oz',
    composition: '98% CO 2% EA',
    finish: 'Rigid · dark indigo',
    moq: '1,000 m',
    leadTimeWeeks: 3,
  });
  await articles.save({ ...a60219, id: DEMO.articles.indigo60219 });
  await articles.save({ ...createArticle({ companyId: DEMO.companies.indigo, code: '60409/1' }, BASE), id: DEMO.articles.indigo60409 });

  const products = [
    { key: 'guess', brand: 'GUESS', name: 'Cropped Denim Blazer', url: 'https://guess.eu/en/cropped-denim-blazer-W5RN12' },
    { key: 'liujo', brand: 'LIU-JO', name: 'Printed Denim Jacket', url: 'https://liujo.com/it/printed-denim-jacket-UF4012' },
    { key: 'armani', brand: 'EMPORIO ARMANI', name: 'Trucker Jacket', url: 'https://armani.com/en/trucker-jacket-6R1B79' },
  ] as const;
  for (const p of products) {
    const product = createProduct({ canonicalUrl: p.url, sourceUrl: p.url, brand: p.brand, name: p.name, imageUrl: null, composition: null }, BASE);
    await productRepo.save({ ...product, id: DEMO.products[p.key] });
  }

  // createdAt strictly increases down this list: the discovery ordering tests depend on it.
  const claims: { product: keyof typeof DEMO.products; company: keyof typeof DEMO.companies; article: string | null; kind: ClaimKind; note?: string; verified?: true }[] = [
    { product: 'guess', company: 'indigo', article: DEMO.articles.indigo60219, kind: 'original', verified: true },
    { product: 'guess', company: 'anka', article: null, kind: 'original', verified: true },
    { product: 'guess', company: 'denizli', article: null, kind: 'equivalent', note: 'Same twill, 13 oz, rigid. Swatch in stock.' },
    { product: 'guess', company: 'bursa', article: null, kind: 'equivalent' },
    { product: 'liujo', company: 'indigo', article: DEMO.articles.indigo60409, kind: 'original' },
    { product: 'armani', company: 'denizli', article: null, kind: 'equivalent' },
  ];
  for (const [i, c] of claims.entries()) {
    const now = at(i + 1);
    const scope = claimScopeOf(suppliers.find((s) => s.key === c.company)!.kind);
    const claim = declareClaim({ productId: DEMO.products[c.product], companyId: DEMO.companies[c.company], articleId: c.article, kind: c.kind, scope, note: c.note }, now);
    await claimRepo.save(c.verified ? verifyClaim(claim, now) : claim);
  }
}
