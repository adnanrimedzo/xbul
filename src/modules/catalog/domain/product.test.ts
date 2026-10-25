import { describe, expect, it } from 'vitest';
import { createProduct } from './product';

const base = { canonicalUrl: 'https://guess.eu/x', sourceUrl: 'https://guess.eu/x', brand: 'GUESS', name: 'Blazer', imageUrl: null, composition: null };

describe('createProduct', () => {
  it('validates brand and name, and drops non-http images', () => {
    const p = createProduct({ canonicalUrl: 'https://guess.eu/x', sourceUrl: 'https://guess.eu/x', brand: ' GUESS ', name: ' Blazer ', imageUrl: 'data:image/png;base64,AA', composition: null });
    expect(p).toMatchObject({ brand: 'GUESS', name: 'Blazer', imageUrl: null });
    expect(() => createProduct({ ...p, brand: '' })).toThrow(expect.objectContaining({ code: 'product.brand_invalid' }));
    expect(() => createProduct({ ...p, name: 'x'.repeat(161) })).toThrow(expect.objectContaining({ code: 'product.name_invalid' }));
  });

  it('keeps http(s) images, assigns id and createdAt, and is frozen', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const p = createProduct({ ...base, imageUrl: 'https://cdn.guess.eu/a.jpg' }, now);
    expect(p.imageUrl).toBe('https://cdn.guess.eu/a.jpg');
    expect(p.createdAt).toBe(now);
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.isFrozen(p)).toBe(true);
  });

  it('enforces the length boundaries', () => {
    expect(createProduct({ ...base, brand: 'b'.repeat(60), name: 'n'.repeat(160) })).toBeTruthy();
    expect(() => createProduct({ ...base, brand: 'b'.repeat(61) })).toThrow(expect.objectContaining({ code: 'product.brand_invalid' }));
    expect(() => createProduct({ ...base, name: '  ' })).toThrow(expect.objectContaining({ code: 'product.name_invalid' }));
  });
});
