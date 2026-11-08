import { eq } from 'drizzle-orm';
import { BRANDS, brandSlug } from '@/app/[lang]/brands/brands';
import { LOCALES, localePath } from '@/i18n/locales';
import { products } from '@/modules/catalog';
import { claims } from '@/modules/claims';
import { articles, companies } from '@/modules/supplier';
import { getContainer } from '@/server/container';

export const dynamic = 'force-dynamic';

const STATIC_PATHS = ['/', '/brands', ...BRANDS.map((b) => `/brands/${brandSlug(b.name)}`), '/privacy', '/terms'];

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Every public page in both languages, each entry naming its other-language twin (hreflang), as Google asks for.
// A route rather than sitemap.ts because it reads the database and the per-environment base URL at request time.
export async function GET(): Promise<Response> {
  const { db, config } = await getContainer();
  const [productRows, companyRows, articleRows] = await Promise.all([
    db
      .selectDistinct({ id: products.id })
      .from(products)
      .innerJoin(claims, eq(claims.productId, products.id))
      .innerJoin(companies, eq(claims.companyId, companies.id))
      .where(eq(companies.status, 'approved')),
    db.select({ slug: companies.slug }).from(companies).where(eq(companies.status, 'approved')),
    db
      .select({ company: companies.slug, slug: articles.slug })
      .from(articles)
      .innerJoin(companies, eq(companies.id, articles.companyId))
      .where(eq(companies.status, 'approved')),
  ]);
  const paths = [
    ...STATIC_PATHS,
    ...productRows.map((r) => `/p/${r.id}`),
    ...companyRows.map((r) => `/m/${r.slug}`),
    ...articleRows.map((r) => `/m/${r.company}/a/${r.slug}`),
  ];

  const urls = paths.flatMap((path) =>
    LOCALES.map((lang) => {
      const links = [...LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xml(config.baseUrl + localePath(l, path))}"/>`), `<xhtml:link rel="alternate" hreflang="x-default" href="${xml(config.baseUrl + path)}"/>`];
      return `<url><loc>${xml(config.baseUrl + localePath(lang, path))}</loc>${links.join('')}</url>`;
    }),
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
