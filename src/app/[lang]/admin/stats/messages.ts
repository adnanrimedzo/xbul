import { defineMessages } from '@/i18n/locales';

export const ADMIN_STATS = defineMessages({
  en: {
    title: 'Stats',
    intro: 'Progress against the launch targets.',
    suppliers: 'Suppliers',
    suppliersNote: 'Target: 20–30',
    products: 'Products',
    productsNote: 'Target: 200–300',
    searchers: 'Visitor-days',
    searchersNote: 'Target: 10–20 customers. One address counts once a day, so this overstates customers.',
    searches: 'Searches',
    searchesNote: (n: number) => `${n} found`,
  },
  tr: {
    title: 'İstatistikler',
    intro: 'Lansman hedeflerine göre ilerleme.',
    suppliers: 'Üreticiler',
    suppliersNote: 'Hedef: 20–30',
    products: 'Ürünler',
    productsNote: 'Hedef: 200–300',
    searchers: 'Ziyaretçi-gün',
    searchersNote: 'Hedef: 10–20 müşteri. Bir adres günde bir kez sayılır, bu yüzden müşteri sayısı olduğundan fazla görünür.',
    searches: 'Aramalar',
    searchesNote: (n: number) => `${n} sonuç bulundu`,
  },
});
