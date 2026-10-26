import { describe, expect, it } from 'vitest';
import { parseProductPage } from './parse-product-page';

const jsonLd = `<html><head><meta property="og:title" content="Ignored | GUESS">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},
{"@type":"Product","name":"Cropped Denim Blazer","brand":{"@type":"Brand","name":"GUESS"},"image":["/img/b1.jpg","/img/b2.jpg"],"material":"100% Cotton"}]}</script></head></html>`;
const ogOnly = `<html><head><script type="application/ld+json">{bad json</script>
<meta property="og:title" content="Printed denim jacket | LIU-JO"><meta property="og:image" content="https://cdn.liujo.com/a.jpg">
<meta property="og:site_name" content="Liu Jo"></head></html>`;

describe('parseProductPage', () => {
  it('prefers JSON-LD Product and resolves relative images', () =>
    expect(parseProductPage(jsonLd, 'https://guess.eu/en/x')).toEqual({ brand: 'GUESS', name: 'Cropped Denim Blazer', imageUrl: 'https://guess.eu/img/b1.jpg', composition: '100% Cotton', confidence: 'structured' }));
  it('falls back to Open Graph, survives bad JSON-LD, strips the brand suffix', () =>
    expect(parseProductPage(ogOnly, 'https://liujo.com/it/x')).toEqual({ brand: 'Liu Jo', name: 'Printed denim jacket', imageUrl: 'https://cdn.liujo.com/a.jpg', composition: null, confidence: 'structured' }));
  it('falls back to <title> and the host brand, and says the title was its only signal', () =>
    expect(parseProductPage('<title>Trucker Jacket</title>', 'https://www.armani.com/x')).toEqual({ brand: 'ARMANI', name: 'Trucker Jacket', imageUrl: null, composition: null, confidence: 'title' }));
  it('returns null without a name', () => expect(parseProductPage('<html><title> </title></html>', 'https://x.com/')).toBeNull());

  it('reads a top-level Product, a Product in an array, a type array, a string brand, a string image and an image object', () => {
    const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
    expect(parseProductPage(ld({ '@type': 'Product', name: 'A', brand: 'Acme', image: 'https://c.com/a.jpg' }), 'https://x.com/')).toMatchObject({ brand: 'Acme', name: 'A', imageUrl: 'https://c.com/a.jpg' });
    expect(parseProductPage(ld([{ '@type': 'Thing' }, { '@type': ['Thing', 'Product'], name: 'B', image: { url: '/b.jpg' } }]), 'https://x.com/p')).toMatchObject({ name: 'B', imageUrl: 'https://x.com/b.jpg' });
  });
  it('keeps a stray suffix when it is not the brand, and strips a dash suffix of the host brand', () => {
    expect(parseProductPage('<title>Jacket | Sale</title>', 'https://armani.com/x')?.name).toBe('Jacket | Sale');
    expect(parseProductPage('<title>Jacket - Armani</title>', 'https://armani.com/x')?.name).toBe('Jacket');
  });
  it('uses product:brand over og:site_name, and null image when it cannot be resolved', () => {
    const html = '<meta property="og:title" content="Coat"><meta property="product:brand" content="Max"><meta property="og:site_name" content="Shop"><meta property="og:image" content="http://[bad">';
    expect(parseProductPage(html, 'https://x.com/')).toEqual({ brand: 'Max', name: 'Coat', imageUrl: null, composition: null, confidence: 'structured' });
  });
});

it('decodes HTML entities in meta and title text', () => {
  expect(parseProductPage('<meta property="og:title" content="Jeans &amp; Co">', 'https://x.com/')?.name).toBe('Jeans & Co');
  expect(parseProductPage('<title>Shirt &amp; Tie</title>', 'https://x.com/')?.name).toBe('Shirt & Tie');
});

it('truncates a long SEO title and brand so the product still fits', () => {
  const html = `<title>${'Blazer '.repeat(60)}</title><meta property="product:brand" content="${'B'.repeat(80)}">`;
  const snapshot = parseProductPage(html, 'https://x.com/');
  expect(snapshot!.name.length).toBeLessThanOrEqual(160);
  expect(snapshot!.name).toBe(snapshot!.name.trim());
  expect(snapshot!.brand).toBe('B'.repeat(60));
});
