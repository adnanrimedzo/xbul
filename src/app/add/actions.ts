'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { toActionError, type ActionResult } from '@/app/_lib/action-result';
import { errorMessage } from '@/app/_lib/error-messages';
import { addProductManually, canonicalizeProductUrl, getProduct, importProduct, type Product } from '@/modules/catalog';
import { publishGarments } from '@/modules/claims';
import { claimScopeOf, upsertArticle } from '@/modules/supplier';
import { getContainer } from '@/server/container';
import { requireMill } from '@/server/viewer';
import { DomainError } from '@/shared/domain/errors';

// `existing` is what the supplier already claimed for this product: the preview fills it in, so publishing again restates the same claim.
export type PreviewRow =
  | {
      url: string;
      state: 'ready';
      productId: string;
      brand: string;
      name: string;
      imageUrl: string | null;
      composition: string | null;
      existing?: { articleCode: string; kind: 'original' | 'equivalent' };
    }
  | { url: string; state: 'needs_details'; reason: 'fetch_failed' | 'not_a_product_page'; guess?: { brand: string; name: string } }
  | { url: string; state: 'invalid'; error: string };

const GENERIC = 'Something went wrong. Please try again.';
const MAX_LINKS = 50;
const IMPORT_CONCURRENCY = 5;
const MAX_URL = 2048;
const MAX_PASTE = 120_000; // 50 links of 2048 characters is ~100,000; anything longer is not a list of links

async function readyRow(url: string, p: Product, companyId: string): Promise<PreviewRow> {
  const { claims, articles } = await getContainer();
  const claim = await claims.findByProductAndCompany(p.id, companyId);
  const article = claim?.articleId ? await articles.findById(claim.articleId) : null; // the stored code is the normalised one, so publishing it finds the same article
  return {
    url,
    state: 'ready',
    productId: p.id,
    brand: p.brand,
    name: p.name,
    imageUrl: p.imageUrl,
    composition: p.composition,
    ...(claim && { existing: { articleCode: article?.code ?? '', kind: claim.kind } }),
  };
}

// One row per distinct canonical URL, so two spellings of one link never import in parallel (that would race on the
// canonical_url unique constraint). A line that isn't a URL has no canonical form and stays a row of its own.
function distinctLinks(lines: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const line of lines) {
    let key = line;
    try {
      key = canonicalizeProductUrl(line);
    } catch (e) {
      if (!(e instanceof DomainError)) throw e;
    }
    if (!byKey.has(key)) byKey.set(key, line);
  }
  return [...byKey.values()];
}

export async function previewGarmentsAction(urlsText: string): Promise<ActionResult<PreviewRow[]>> {
  const { company } = await requireMill(); // the server fetches whatever it is given, so only a signed-in supplier may ask
  if (typeof urlsText !== 'string' || urlsText.length > MAX_PASTE) return toActionError(new DomainError('claims.batch_size_invalid'));
  const links = distinctLinks(
    urlsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  if (links.length < 1 || links.length > MAX_LINKS) return toActionError(new DomainError('claims.batch_size_invalid'));

  const { products, fetcher, config } = await getContainer();
  // One bad row (a blocked page, a database hiccup) must never fail the whole preview.
  const toRow = async (url: string): Promise<PreviewRow> => {
    try {
      if (url.length > MAX_URL) throw new DomainError('product.url_invalid');
      const result = await importProduct({ products, fetcher, allowPrivateHosts: config.allowPrivateHosts }, url);
      return result.status === 'ok' ? await readyRow(url, result.product, company.id) : { url, state: 'needs_details', reason: result.reason, guess: result.guess };
    } catch (e) {
      if (e instanceof DomainError) return { url, state: 'invalid', error: errorMessage(e.code) };
      console.error('previewGarmentsAction: row failed', url, e);
      return { url, state: 'invalid', error: GENERIC };
    }
  };

  const rows: PreviewRow[] = [];
  for (let i = 0; i < links.length; i += IMPORT_CONCURRENCY) {
    rows.push(...(await Promise.all(links.slice(i, i + IMPORT_CONCURRENCY).map(toRow))));
  }
  return { ok: true, data: rows };
}

const manualSchema = z.object({
  url: z.string().trim().max(MAX_URL),
  brand: z.string().trim().max(60),
  name: z.string().trim().max(160),
});
// Minimums and the URL check are the domain's (they have messages); a too-long field gets that field's message.
const FIELD_CODE: Record<string, string> = { url: 'product.url_invalid', brand: 'product.brand_invalid', name: 'product.name_invalid' };

export async function addManualProductAction(input: { url: string; brand: string; name: string }): Promise<ActionResult<PreviewRow>> {
  const { company } = await requireMill();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, error: typeof field === 'string' && field in FIELD_CODE ? errorMessage(FIELD_CODE[field]!) : GENERIC };
  }

  const { products, config } = await getContainer();
  try {
    const product = await addProductManually({ products, allowPrivateHosts: config.allowPrivateHosts }, parsed.data);
    return { ok: true, data: await readyRow(parsed.data.url, product, company.id) };
  } catch (e) {
    return toActionError(e);
  }
}

const itemsSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      articleCode: z.string().trim().max(40),
      kind: z.enum(['original', 'equivalent']),
    }),
  )
  .min(1)
  .max(MAX_LINKS);

export async function publishGarmentsAction(
  items: { productId: string; articleCode: string; kind: 'original' | 'equivalent' }[],
): Promise<ActionResult<{ count: number }>> {
  const { company } = await requireMill(); // never from the client
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { claims, evidence, evidenceStore, products, articles } = await getContainer();
  try {
    await publishGarments(
      {
        claims,
        evidence,
        store: evidenceStore,
        getProduct: (id) => getProduct({ products }, id),
        upsertArticle: (input) => upsertArticle({ articles }, input),
      },
      { companyId: company.id, scope: claimScopeOf(company.kind), items: parsed.data.map((item) => ({ ...item, articleCode: item.articleCode || null })) },
    );
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/m/${company.slug}`); // outside the try: redirect() works by throwing
}
