import { defineMessages } from '@/i18n/locales';

export const VERIFY = defineMessages({
  en: {
    title: 'Get verified',
    documents: 'Documents',
    remove: 'Remove',
    breadcrumb: 'Breadcrumb',
    underReview: 'Under review',
    underReviewBody: 'An admin is checking these documents. They are deleted as soon as the decision is made.',
    rejected: (note: string) => `Rejected: ${note}. Add new documents and submit again.`,
    uploadIntro: 'Upload an invoice, order or correspondence with the customer. Cover prices if you like. Your documents stay private and are deleted once reviewed.',
    privacy: 'Privacy',
    submit: 'Submit for review',
    addDocument: 'Add a document',
    hint: (maxFiles: number, mb: number) => `PDF, JPG or PNG, up to ${maxFiles} files of ${mb} MB each.`,
    uploading: 'Uploading…',
  },
  tr: {
    title: 'Doğrulama',
    documents: 'Belgeler',
    remove: 'Kaldır',
    breadcrumb: 'Sayfa yolu',
    underReview: 'İncelemede',
    underReviewBody: 'Bir yönetici bu belgeleri kontrol ediyor. Belgeler karar verilir verilmez silinir.',
    rejected: (note: string) => `Reddedildi: ${note}. Yeni belgeler ekleyip tekrar gönderin.`,
    uploadIntro: 'Müşteriyle ilgili bir fatura, sipariş veya yazışma yükleyin. İsterseniz fiyatları kapatabilirsiniz. Belgeleriniz gizli kalır ve inceleme sonrasında silinir.',
    privacy: 'Gizlilik',
    submit: 'İncelemeye gönder',
    addDocument: 'Belge ekle',
    hint: (maxFiles: number, mb: number) => `PDF, JPG veya PNG; her biri en fazla ${mb} MB olan en fazla ${maxFiles} dosya.`,
    uploading: 'Yükleniyor…',
  },
});
