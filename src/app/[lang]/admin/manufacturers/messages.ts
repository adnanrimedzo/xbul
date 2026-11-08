import { defineMessages } from '@/i18n/locales';
import { KIND_LABEL } from '@/app/_lib/kind-labels';
import type { CompanyStatus } from '@/modules/supplier';

type Counts = { pass: number; fail: number; unknown: number };

// Shared by the queue and the review page.
export const ADMIN_MANUFACTURERS = defineMessages({
  en: {
    title: 'Manufacturers',
    intro: 'Company registrations by status. Submitted ones are listed longest waiting first.',
    tabs: 'Status',
    statuses: {
      submitted: 'Submitted',
      changes_requested: 'Changes requested',
      approved: 'Approved',
      rejected: 'Rejected',
      draft: 'Draft',
    } satisfies Record<CompanyStatus, string>,
    kinds: KIND_LABEL.en,
    submittedAgo: (ago: string) => `submitted ${ago}`,
    neverSubmitted: 'no submission on record',
    checks: (c: Counts) => `Checks: ${c.pass} pass, ${c.fail} fail, ${c.unknown} unknown`,
    nothing: 'No companies with this status.',
  },
  tr: {
    title: 'Üreticiler',
    intro: 'Duruma göre firma kayıtları. Gönderilenler en uzun bekleyen önce listelenir.',
    tabs: 'Durum',
    statuses: {
      submitted: 'Gönderildi',
      changes_requested: 'Değişiklik istendi',
      approved: 'Onaylandı',
      rejected: 'Reddedildi',
      draft: 'Taslak',
    },
    kinds: KIND_LABEL.tr,
    submittedAgo: (ago: string) => `gönderilme: ${ago}`,
    neverSubmitted: 'gönderim kaydı yok',
    checks: (c: Counts) => `Kontroller: ${c.pass} geçti, ${c.fail} kaldı, ${c.unknown} belirsiz`,
    nothing: 'Bu durumda firma yok.',
  },
});
