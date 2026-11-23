import { DomainError } from '@/shared/domain/errors';
import type { PhotoModel } from '../application/ports';
import { EMBEDDING_DIMENSIONS } from '../application/analyse-photo';

// A deterministic stand-in for Workers AI, for `next dev` and the e2e tests (PHOTO_AI=fake). The page re-encodes every
// photo, so bytes change but pixel sizes don't: the fake keys off the JPEG's width and height. Fixtures in
// e2e/fixtures/photos are made at these sizes; any other size counts as the denim jacket, e.g. a downscaled big photo.
type Concept = 'denim_jacket' | 'denim_fabric' | 'sweater' | 'mug' | 'dark' | 'fail';

export const FAKE_SIZES: Readonly<Record<string, Concept>> = {
  '600x750': 'denim_jacket', // a buyer's photo
  '601x751': 'denim_jacket', // a supplier's photo of the same jacket
  '700x700': 'denim_fabric', // a close-up of its fabric
  '640x800': 'sweater',
  '640x480': 'mug',
  '500x500': 'dark',
  '333x333': 'fail',
};

const s = (value: unknown, confidence: number) => ({ value, confidence });
const VERDICTS: Readonly<Record<Exclude<Concept, 'fail'>, object>> = {
  denim_jacket: {
    textile: true, reason: 'ok', confidence: 0.95, category: 'garment', productType: 'jacket', colors: ['blue'], viewKind: 'product',
    construction: s('woven', 0.95), pattern: s('twill', 0.9), twillRatio: s('3/1', 0.6), twillDirection: s('rht', 0.6), denim: s(true, 0.95), dye: null,
  },
  denim_fabric: {
    textile: true, reason: 'ok', confidence: 0.95, category: 'fabric', productType: null, colors: ['blue'], viewKind: 'close_up',
    construction: s('woven', 0.97), pattern: s('twill', 0.95), twillRatio: s('3/1', 0.9), twillDirection: s('rht', 0.9), denim: s(true, 0.95), dye: s('rope', 0.7),
  },
  sweater: {
    textile: true, reason: 'ok', confidence: 0.9, category: 'garment', productType: 'knit_top', colors: ['grey'], viewKind: 'product',
    construction: s('knitted', 0.9), pattern: s('rib', 0.5), twillRatio: null, twillDirection: null, denim: s(false, 0.9), dye: null,
  },
  mug: { textile: false, reason: 'not_textile', confidence: 0.98, category: null, productType: null, colors: ['white'], viewKind: 'product' },
  dark: { textile: true, reason: 'too_dark_or_blurry', confidence: 0.4, category: 'garment', productType: null, colors: [], viewKind: 'product' },
};

// JPEG width and height from the first start-of-frame marker.
export function jpegSize(bytes: Uint8Array): string | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return `${(bytes[i + 7] << 8) | bytes[i + 8]}x${(bytes[i + 5] << 8) | bytes[i + 6]}`;
    }
    i += 2 + length;
  }
  return null;
}

function conceptOf(base64: string): { concept: Concept; size: string } {
  const size = jpegSize(new Uint8Array(Buffer.from(base64, 'base64'))) ?? 'unknown';
  return { concept: FAKE_SIZES[size] ?? 'denim_jacket', size };
}

// Unit vectors from a seeded PRNG: each concept has its own direction, and each size adds a little noise, so two photos
// of one concept score ≈0.99 and unrelated concepts ≈0. The fabric close-up leans 80% toward the jacket it came from.
function seeded(seed: string): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const v: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    v.push(((h >>> 0) / 4294967296) * 2 - 1);
  }
  return unit(v);
}
const unit = (v: number[]) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const mix = (a: number[], b: number[], wa: number, wb: number) => unit(a.map((x, i) => wa * x + wb * b[i]));

function vectorOf(concept: Concept, size: string): number[] {
  const base = concept === 'denim_fabric' ? mix(seeded('denim_jacket'), seeded('denim_fabric'), 0.8, 0.6) : seeded(concept);
  return mix(base, seeded(`noise:${size}`), 1, 0.1);
}

export function createFakePhotoModel(): PhotoModel {
  return {
    embeddingModel: 'fake-embedding',
    async inspect(base64) {
      const { concept } = conceptOf(base64);
      if (concept === 'fail') throw new DomainError('photo.ai_unavailable');
      return JSON.stringify(VERDICTS[concept]);
    },
    async embedImage(base64) {
      const { concept, size } = conceptOf(base64);
      if (concept === 'fail') throw new DomainError('photo.ai_unavailable');
      return vectorOf(concept, size);
    },
  };
}
