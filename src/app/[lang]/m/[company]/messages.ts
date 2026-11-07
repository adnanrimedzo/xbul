import { defineMessages } from '@/i18n/locales';
import { KIND_LABEL } from '@/app/_lib/kind-labels';
import type { CompanyKind, CompanyStatus } from '@/modules/supplier';

const KIND_EN = KIND_LABEL.en;
const KIND_TR = KIND_LABEL.tr;

export const COMPANY = defineMessages({
  en: {
    kindIn: (kind: CompanyKind, place: string) => `${KIND_EN[kind]} in ${place}`,
    metaTitle: (name: string, kind: CompanyKind, place: string) => `${name}: ${KIND_EN[kind].toLowerCase()} in ${place}`,
    metaDescription: (name: string, kind: CompanyKind, place: string) =>
      `${name} is a ${KIND_EN[kind].toLowerCase()} in ${place}. See the clothing products it made or can make an equivalent of, its product codes and its contact details.`,
    contact: 'Contact directly',
    certifications: 'Certifications',
    validUntil: (date: string) => `valid until ${date}`,
    codes: 'Product codes',
    productCount: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
    products: 'Products',
    none: 'No products linked yet.',
    remove: 'Remove',
    confirmRemove: 'Confirm remove',
    underReview: 'Under review',
    rejected: 'Rejected: see why',
    getVerified: 'Get verified',
    notPublic: {
      draft: 'Not public yet. Complete your registration and submit it for review.',
      submitted: "Not public yet. We're reviewing your registration.",
      changes_requested: 'Not public yet. We need more information about your company.',
      rejected: 'Your registration was not approved.',
    } satisfies Record<Exclude<CompanyStatus, 'approved'>, string>,
    goToRegistration: 'Go to your registration',
  },
  tr: {
    kindIn: (kind: CompanyKind, place: string) => `${place} merkezli ${KIND_TR[kind].toLocaleLowerCase('tr')}`,
    metaTitle: (name: string, kind: CompanyKind, place: string) => `${name}: ${place} merkezli ${KIND_TR[kind].toLocaleLowerCase('tr')}`,
    metaDescription: (name: string, kind: CompanyKind, place: string) =>
      `${name}, ${place} merkezli bir ${KIND_TR[kind].toLocaleLowerCase('tr')}. Ürettiği ya da muadilini üretebileceği hazır giyim ürünlerini, ürün kodlarını ve iletişim bilgilerini görün.`,
    contact: 'Doğrudan iletişim',
    certifications: 'Sertifikalar',
    validUntil: (date: string) => `geçerlilik: ${date}`,
    codes: 'Ürün kodları',
    productCount: (n: number) => `${n} ürün`,
    products: 'Ürünler',
    none: 'Henüz bağlı ürün yok.',
    remove: 'Kaldır',
    confirmRemove: 'Kaldırmayı onaylayın',
    underReview: 'İncelemede',
    rejected: 'Reddedildi: nedenini görün',
    getVerified: 'Doğrulama alın',
    notPublic: {
      draft: 'Henüz herkese açık değil. Kaydınızı tamamlayıp incelemeye gönderin.',
      submitted: 'Henüz herkese açık değil. Kaydınızı inceliyoruz.',
      changes_requested: 'Henüz herkese açık değil. Firmanız hakkında daha fazla bilgiye ihtiyacımız var.',
      rejected: 'Kaydınız onaylanmadı.',
    },
    goToRegistration: 'Kaydınıza gidin',
  },
});
