export type Localized = { en: string; tr: string };

export type PartId = 'garment' | 'fabric' | 'yarn' | 'trims' | 'sewing' | 'washing' | 'printing';

export const PARTS: readonly { id: PartId; full: boolean; label: Localized }[] = [
  { id: 'garment', full: true, label: { en: 'Finished product', tr: 'Bitmiş ürün' } },
  { id: 'fabric', full: false, label: { en: 'Fabric', tr: 'Kumaş' } },
  { id: 'yarn', full: false, label: { en: 'Yarn', tr: 'İplik' } },
  { id: 'trims', full: false, label: { en: 'Trims and accessories', tr: 'Aksesuar' } },
  { id: 'sewing', full: false, label: { en: 'Cut, make and trim (CMT)', tr: 'Fason kesim-dikim' } },
  { id: 'washing', full: false, label: { en: 'Washing and finishing', tr: 'Yıkama ve apre' } },
  { id: 'printing', full: false, label: { en: 'Printing and embroidery', tr: 'Baskı ve nakış' } },
];

export function isFullProduct(p: PartId): boolean {
  return PARTS.find((x) => x.id === p)?.full ?? false;
}
