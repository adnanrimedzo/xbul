import { defineMessages } from '@/i18n/locales';
import { PARTS, type PartId } from '@/shared/domain/taxonomy';

const scopeLabels = (lang: 'en' | 'tr') =>
  Object.fromEntries(PARTS.map((p) => [p.id, p.label[lang].toLocaleLowerCase(lang)])) as Record<PartId, string>;

export const ADMIN_CLAIMS = defineMessages({
  en: {
    scope: scopeLabels('en'),
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
    scope: scopeLabels('tr'),
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
