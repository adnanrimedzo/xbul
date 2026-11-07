import type { Locale } from '@/i18n/locales';

// "H&M" → "h-and-m", "Levi's" → "levi-s". The product page's breadcrumb links here with the same rule.
export const brandSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, '-and-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type Source = { label: string; url: string };
type Fact = Record<Locale, string> & { source?: Source };

export type Brand = {
  name: string;
  // Spellings a product's brand field may use, compared case-insensitively.
  aliases: string[];
  group?: string;
  country: Record<Locale, string>;
  // Only facts with a public source. Brand pages say nothing about a brand's suppliers that isn't sourced.
  facts: Fact[];
};

const SPAIN = { en: 'Spain', tr: 'İspanya' };
const SWEDEN = { en: 'Sweden', tr: 'İsveç' };
const TURKIYE = { en: 'Türkiye', tr: 'Türkiye' };
const USA = { en: 'United States', tr: 'ABD' };

const INDITEX_FACT: Fact = {
  en: 'Inditex publishes how many suppliers it uses in each country, but not the names of individual factories. Trade press reported 847 factories in Türkiye working for its suppliers in 2023.',
  tr: 'Inditex her ülkede kaç tedarikçiyle çalıştığını yayımlıyor, ancak tek tek fabrikaların adlarını yayımlamıyor. Sektör basınına göre 2023’te Türkiye’de tedarikçileri için çalışan 847 fabrika vardı.',
  source: { label: 'Modaes: Inditex sourcing', url: 'https://www.modaes.com/global/companies/inditex-sourcing-where-does-zara-owner-make-its-clothes' },
};
const inditex = (name: string, aliases: string[] = []): Brand => ({ name, aliases: [name, ...aliases], group: 'Inditex', country: SPAIN, facts: [INDITEX_FACT] });

const HM_FACT: Fact = {
  en: 'H&M Group has published a list of its supplier factories since 2013. It covers the suppliers it works with long term, around 95% of its order volume.',
  tr: 'H&M Group, 2013’ten beri tedarikçi fabrikalarının listesini yayımlıyor. Liste, uzun süreli çalıştığı tedarikçileri, yani sipariş hacminin yaklaşık %95’ini kapsıyor.',
  source: { label: 'H&M Group via Business & Human Rights Resource Centre', url: 'https://www.business-humanrights.org/en/hm-lists-individual-suppliers-for-each-of-its-garments-to-increase-supply-chain-transparency' },
};

export const BRANDS: Brand[] = [
  inditex('Zara'),
  { name: 'H&M', aliases: ['H&M', 'H & M', 'HM'], group: 'H&M Group', country: SWEDEN, facts: [HM_FACT] },
  { name: 'Mango', aliases: ['Mango'], country: SPAIN, facts: [] },
  inditex('Bershka'),
  inditex('Pull&Bear', ['Pull & Bear', 'Pull and Bear']),
  inditex('Massimo Dutti'),
  inditex('Stradivarius'),
  { name: 'COS', aliases: ['COS'], group: 'H&M Group', country: SWEDEN, facts: [HM_FACT] },
  { name: 'LC Waikiki', aliases: ['LC Waikiki', 'LCW'], country: TURKIYE, facts: [] },
  { name: 'Koton', aliases: ['Koton'], country: TURKIYE, facts: [] },
  { name: 'DeFacto', aliases: ['DeFacto', 'Defacto'], country: TURKIYE, facts: [] },
  { name: 'Mavi', aliases: ['Mavi', 'Mavi Jeans'], country: TURKIYE, facts: [] },
  { name: 'GUESS', aliases: ['GUESS', 'Guess', 'GUESS?'], country: USA, facts: [] },
  { name: 'Levi’s', aliases: ["Levi's", 'Levi’s', 'Levis'], country: USA, facts: [] },
];

export const findBrand = (slug: string) => BRANDS.find((b) => brandSlug(b.name) === slug);

// Why Türkiye comes up so often on brand pages: it is one of the largest garment exporters, close to Europe.
export const TURKIYE_FACT: Fact = {
  en: 'Türkiye is the 7th largest exporter of ready-made clothing in the world and the 3rd in Europe, according to its Ministry of Trade.',
  tr: 'Ticaret Bakanlığı’na göre Türkiye, hazır giyim ihracatında dünyada 7., Avrupa’da 3. sırada.',
  source: { label: 'Daily Sabah, February 2024', url: 'https://www.dailysabah.com/business/economy/turkiye-ranks-7th-globally-in-textile-ready-to-wear-exports' },
};
