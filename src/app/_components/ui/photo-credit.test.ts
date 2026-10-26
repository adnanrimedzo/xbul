import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { GarmentImage } from './garment-image';
import { GarmentTile } from './garment-tile';

const tile = { productId: 'p', brand: 'GUESS', name: 'Blazer', sourceUrl: 'https://www.guess.eu/b', kind: null, originals: 1, equivalents: 0 };
const credit = { host: 'guess.eu', href: 'https://www.guess.eu/b' };

it('credits a photo only when there is one', () => {
  expect(renderToStaticMarkup(createElement(GarmentImage, { src: 'https://img.guess.eu/b.jpg', alt: 'Blazer', credit }))).toContain('Photo: guess.eu');
  expect(renderToStaticMarkup(createElement(GarmentImage, { src: null, alt: 'Blazer', credit }))).not.toContain('Photo:');
});

it('labels a tile with the photo host only when it has a photo', () => {
  const html = (imageUrl: string | null) => renderToStaticMarkup(createElement(GarmentTile, { tile: { ...tile, imageUrl }, href: '/p/p', tag: 'Tagged' }));
  expect(html('https://img.guess.eu/b.jpg')).toContain('Photo: guess.eu');
  expect(html(null)).not.toContain('Photo:');
});
