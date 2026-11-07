import { defineMessages } from '@/i18n/locales';

export const ADMIN_CLAIMS = defineMessages({
  en: {
    scope: { fabric: 'fabric', garment: 'garment' },
    toReview: (n: number) => `To review: ${n}`,
    intro: 'Originals sent in for review, longest waiting first.',
    documents: 'Documents',
    approve: 'Approve',
    confirmApprove: 'Confirm approve',
    nothing: 'Nothing to review.',
    reason: 'Reason',
    reject: 'Reject',
  },
  tr: {
    scope: { fabric: 'kumaş', garment: 'hazır giyim' },
    toReview: (n: number) => `İncelenecek: ${n}`,
    intro: 'İncelemeye gönderilen orijinal beyanlar, en uzun bekleyen önce.',
    documents: 'Belgeler',
    approve: 'Onayla',
    confirmApprove: 'Onayı kesinleştir',
    nothing: 'İncelenecek bir şey yok.',
    reason: 'Gerekçe',
    reject: 'Reddet',
  },
});
