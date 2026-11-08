import { defineMessages } from '@/i18n/locales';

export const ARTICLE = defineMessages({
  en: {
    metaTitle: (code: string, company: string) => `Code ${code} by ${company}`,
    metaFallback: (company: string) => `Supplier: ${company}`,
    code: (code: string) => `Code ${code}`,
    by: (company: string, place: string) => `By ${company}, ${place}`,
    copyLink: 'Copy link',
    sheet: 'Technical sheet',
    contact: 'Contact directly',
    weight: 'Weight',
    composition: 'Composition',
    finish: 'Finish',
    moqLead: 'MOQ and lead time',
    weeks: (n: number) => `${n} wks`,
    linked: (n: number) => `Linked to ${n} ${n === 1 ? 'product' : 'products'}`,
  },
  tr: {
    metaTitle: (code: string, company: string) => `${company} ürün kodu ${code}`,
    metaFallback: (company: string) => `Üretici: ${company}`,
    code: (code: string) => `Kod ${code}`,
    by: (company: string, place: string) => `${company}, ${place}`,
    copyLink: 'Linki kopyala',
    sheet: 'Teknik föy',
    contact: 'Doğrudan iletişim',
    weight: 'Gramaj',
    composition: 'Kompozisyon',
    finish: 'Apre',
    moqLead: 'MOQ ve termin süresi',
    weeks: (n: number) => `${n} hafta`,
    linked: (n: number) => `${n} ürüne bağlı`,
  },
});
