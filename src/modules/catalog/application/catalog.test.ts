import { expect, it } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createProductRepository } from '../infrastructure/drizzle-product-repository';
import { addProductManually } from './add-product-manually';
import { findProductByUrl, getProduct } from './find-product';
import { importProduct } from './import-product';
import { setProductTypeIfEmpty } from './set-product-type';

const html = `<script type="application/ld+json">{"@type":"Product","name":"Cropped Denim Blazer","brand":"GUESS","image":"https://img.guess.eu/b.jpg"}</script>`;
const fetcherReturning = (body: string | Error) => {
  const calls: string[] = [];
  return { calls, fetchHtml: async (u: string) => { calls.push(u); if (body instanceof Error) throw body; return body; } };
};

it('imports once and dedupes tracking-param variants', async () => {
  const products = createProductRepository(await createTestDb());
  const fetcher = fetcherReturning(html);
  const a = await importProduct({ products, fetcher, allowPrivateHosts: false }, 'https://www.guess.eu/en/b-1');
  const b = await importProduct({ products, fetcher, allowPrivateHosts: false }, 'https://guess.eu/en/b-1/?utm_source=wa');
  expect(a).toMatchObject({ status: 'ok', product: { brand: 'GUESS', name: 'Cropped Denim Blazer', sourceUrl: 'https://www.guess.eu/en/b-1' } });
  expect(b.status === 'ok' && a.status === 'ok' && b.product.id === a.product.id).toBe(true);
  expect(fetcher.calls).toEqual(['https://www.guess.eu/en/b-1']);
});

it('asks for details when the fetch fails or the page is not a product', async () => {
  const products = createProductRepository(await createTestDb());
  expect(await importProduct({ products, fetcher: fetcherReturning(new Error('403')), allowPrivateHosts: false }, 'https://zara.com/p1'))
    .toEqual({ status: 'needs_details', url: 'https://zara.com/p1', canonicalUrl: 'https://zara.com/p1', reason: 'fetch_failed' });
  expect(await importProduct({ products, fetcher: fetcherReturning('<html></html>'), allowPrivateHosts: false }, 'https://zara.com/p2'))
    .toMatchObject({ status: 'needs_details', reason: 'not_a_product_page' });
  expect(await products.findByCanonicalUrl('https://zara.com/p1')).toBeNull();
});

it('saves nothing for a page whose only signal is its <title>, and returns the guess for the manual form', async () => {
  const products = createProductRepository(await createTestDb());
  expect(await importProduct({ products, fetcher: fetcherReturning('<title>Trucker Jacket - Armani</title>'), allowPrivateHosts: false }, 'https://www.armani.com/x'))
    .toEqual({ status: 'needs_details', url: 'https://www.armani.com/x', canonicalUrl: 'https://armani.com/x', reason: 'not_a_product_page', guess: { brand: 'ARMANI', name: 'Trucker Jacket' } });
  expect(await products.findByCanonicalUrl('https://armani.com/x')).toBeNull();
});

it('never fetches private hosts', async () => {
  const fetcher = fetcherReturning(html);
  await expect(importProduct({ products: createProductRepository(await createTestDb()), fetcher, allowPrivateHosts: false }, 'http://169.254.169.254/latest'))
    .rejects.toMatchObject({ code: 'product.url_not_public' });
  expect(fetcher.calls).toHaveLength(0);
});

it('rejects an invalid url before fetching', async () => {
  const fetcher = fetcherReturning(html);
  await expect(importProduct({ products: createProductRepository(await createTestDb()), fetcher, allowPrivateHosts: false }, 'not a url'))
    .rejects.toMatchObject({ code: 'product.url_invalid' });
  expect(fetcher.calls).toHaveLength(0);
});

it('adds manually and finds by any URL variant', async () => {
  const products = createProductRepository(await createTestDb());
  const p = await addProductManually({ products, allowPrivateHosts: false }, { url: 'https://zara.com/tr/overshirt-p9', brand: 'ZARA', name: 'Black Denim Overshirt' });
  expect(p).toMatchObject({ imageUrl: null, composition: null, canonicalUrl: 'https://zara.com/tr/overshirt-p9' });
  expect((await findProductByUrl({ products }, 'https://www.zara.com/tr/overshirt-p9/'))?.id).toBe(p.id);
  expect((await getProduct({ products }, p.id))?.name).toBe('Black Denim Overshirt');
  expect(await getProduct({ products }, crypto.randomUUID())).toBeNull();
  expect(await findProductByUrl({ products }, 'not a url')).toBeNull();
});

it('returns the existing product when adding manually twice, and guards private hosts', async () => {
  const products = createProductRepository(await createTestDb());
  const deps = { products, allowPrivateHosts: false };
  const a = await addProductManually(deps, { url: 'https://zara.com/p9', brand: 'ZARA', name: 'Overshirt' });
  const b = await addProductManually(deps, { url: 'https://www.zara.com/p9?utm_source=x', brand: 'ZARA', name: 'Other name' });
  expect(b.id).toBe(a.id);
  await expect(addProductManually(deps, { url: 'http://localhost/p', brand: 'X', name: 'Y' })).rejects.toMatchObject({ code: 'product.url_not_public' });
});

it('getProduct returns null for an id that is not a uuid', async () => {
  expect(await getProduct({ products: createProductRepository(await createTestDb()) }, 'not-a-uuid')).toBeNull();
});

it('sets the product type once: the first claimer wins, and bad input is refused', async () => {
  const products = createProductRepository(await createTestDb());
  const p = await addProductManually({ products, allowPrivateHosts: false }, { url: 'https://zara.com/tr/jeans-p1', brand: 'ZARA', name: 'Slim Jeans' });
  expect(p.type).toBeNull();
  await setProductTypeIfEmpty({ products }, { productId: p.id, type: 'jeans' });
  await setProductTypeIfEmpty({ products }, { productId: p.id, type: 'jacket' });
  expect((await products.findById(p.id))?.type).toBe('jeans');
  await expect(setProductTypeIfEmpty({ products }, { productId: p.id, type: 'wizard' })).rejects.toMatchObject({ code: 'product.type_invalid' });
  await expect(setProductTypeIfEmpty({ products }, { productId: crypto.randomUUID(), type: 'jeans' })).rejects.toMatchObject({ code: 'product.not_found' });
});
