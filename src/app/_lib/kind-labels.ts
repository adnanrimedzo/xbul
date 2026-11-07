import type { CompanyKind } from '@/modules/supplier';

// What each kind of company is called, as a noun phrase ("Yarn spinner in Bursa").
export const KIND_LABEL = {
  en: {
    garment_maker: 'Garment maker',
    fabric_mill: 'Fabric mill',
    yarn_spinner: 'Yarn spinner',
    trims_maker: 'Trims maker',
    sewing_contractor: 'Sewing contractor',
    laundry: 'Laundry',
    print_house: 'Print and embroidery house',
  },
  tr: {
    garment_maker: 'Hazır giyim üreticisi',
    fabric_mill: 'Kumaş fabrikası',
    yarn_spinner: 'İplik üreticisi',
    trims_maker: 'Aksesuar üreticisi',
    sewing_contractor: 'Fason kesim-dikim atölyesi',
    laundry: 'Yıkama ve apre tesisi',
    print_house: 'Baskı ve nakış atölyesi',
  },
} satisfies Record<'en' | 'tr', Record<CompanyKind, string>>;
