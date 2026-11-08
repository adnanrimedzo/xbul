import { defineMessages } from '@/i18n/locales';
import type { PartId } from '@/shared/domain/taxonomy';

export const PRODUCT = defineMessages({
  en: {
    metaTitle: (brand: string, name: string) => `Who made the ${brand} ${name}? Fabric mill and garment maker`,
    metaFallback: (brand: string, name: string) => `Find the fabric mill and garment maker behind the ${brand} ${name}.`,
    madeBy: (label: string, company: string, code: string | null) => `${label} by ${company}${code ? ` (code ${code})` : ''}`,
    equivalents: (n: number) => `${n} ${n === 1 ? 'supplier' : 'suppliers'} can make an equivalent`,
    code: (code: string) => `Code ${code}`,
    weeks: (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`,
    back: 'Back to search',
    viewOn: (host: string) => `View on ${host} ↗`,
    whoMade: {
      garment: 'Who made it',
      fabric: 'Who made the fabric',
      yarn: 'Who made the yarn',
      trims: 'Who made the trims and accessories',
      sewing: 'Who did the cut, make and trim (CMT)',
      washing: 'Who did the washing and finishing',
      printing: 'Who did the printing and embroidery',
    } satisfies Record<PartId, string>,
    fullProduct: 'Full product',
    partial: (label: string) => `Partial · ${label}`,
    claim: 'Are you a supplier? Claim this product',
    copyLink: 'Copy link',
    home: 'Home',
  },
  tr: {
    metaTitle: (brand: string, name: string) => `${brand} ${name} kim üretti? Kumaş fabrikası ve hazır giyim üreticisi`,
    metaFallback: (brand: string, name: string) => `${brand} ${name} ürününün arkasındaki kumaş fabrikasını ve hazır giyim üreticisini bulun.`,
    madeBy: (label: string, company: string, code: string | null) => `${label}: ${company}${code ? ` (kod ${code})` : ''}`,
    equivalents: (n: number) => `${n} üretici muadilini üretebilir`,
    code: (code: string) => `Kod ${code}`,
    weeks: (n: number) => `${n} hafta`,
    back: 'Aramaya dön',
    viewOn: (host: string) => `${host} sitesinde görün ↗`,
    // Each title by hand: Turkish puts the part in the accusative, which the part's label can't give.
    whoMade: {
      garment: 'Üretici',
      fabric: 'Kumaşı kim üretti',
      yarn: 'İpliği kim üretti',
      trims: 'Aksesuarı kim üretti',
      sewing: 'Kesim-dikimi kim yaptı',
      washing: 'Yıkama ve apreyi kim yaptı',
      printing: 'Baskı ve nakışı kim yaptı',
    },
    fullProduct: 'Tam ürün',
    partial: (label: string) => `Kısmi · ${label}`,
    claim: 'Üretici misiniz? Bu ürün için beyanda bulunun',
    copyLink: 'Linki kopyala',
    home: 'Ana sayfa',
  },
});
