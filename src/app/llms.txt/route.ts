import { BRANDS, brandSlug, TURKIYE_FACT } from '@/app/[lang]/brands/brands';
import { HOME } from '@/app/[lang]/home-messages';
import { getContainer } from '@/server/container';

export const dynamic = 'force-dynamic';

// llms.txt (https://llmstxt.org): a plain summary of the site for AI assistants, built from the same copy the pages use.
export async function GET(): Promise<Response> {
  const { config, photoSearchPublic } = await getContainer();
  const base = config.baseUrl;
  const t = HOME.en;
  const body = `# xbul.io

> ${t.metaDescription}

xbul.io lists which suppliers made a clothing product, or can make an equivalent. Suppliers tag products themselves: "We made this" means they say they produced that exact product; "Can make an equivalent" means they can make one of the same type and quality. A Verified badge means xbul.io reviewed evidence (such as invoices) for that supplier and product; it is not a guarantee of quality, price or delivery. Buyers contact suppliers directly; xbul.io takes no part in the deal and charges no commission. Brand names identify products only; xbul.io isn't affiliated with any brand.

The site is in English (bare paths) and Turkish (under /tr).

## Main pages

- [Search by product link](${base}/): paste a product URL from any brand's website
${photoSearchPublic ? `- [Search with a photo](${base}/photo): upload a photo of clothing or fabric to see suppliers who make the same or similar products\n` : ''}- [Brands](${base}/brands): who makes clothes for well-known brands
- [How it works](${base}/#how-it-works)
- [FAQ](${base}/#faq)
- [Türkçe](${base}/tr)

## Brands

${BRANDS.map((b) => `- [Who makes ${b.name} clothes?](${base}/brands/${brandSlug(b.name)})`).join('\n')}

## FAQ

${t.faq.map(([q, a]) => `### ${q}\n\n${a}`).join('\n\n')}

## Facts

- ${TURKIYE_FACT.en} Source: ${TURKIYE_FACT.source!.url}

## Optional

- [Privacy](${base}/privacy)
- [Terms](${base}/terms)
- [Sitemap](${base}/sitemap.xml)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
