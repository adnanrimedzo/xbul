import { defineMessages } from '@/i18n/locales';

// The contact form's strings. Kept apart from messages.ts, which belongs to the company page.
export const EDIT_CONTACT = defineMessages({
  en: {
    edit: 'Edit contact details',
    contactEmail: 'Contact email',
    phone: 'Phone',
    website: 'Website',
    saved: 'Contact saved.',
    save: 'Save contact',
  },
  tr: {
    edit: 'İletişim bilgilerini düzenle',
    contactEmail: 'İletişim e-postası',
    phone: 'Telefon',
    website: 'Web sitesi',
    saved: 'İletişim bilgileri kaydedildi.',
    save: 'İletişim bilgilerini kaydet',
  },
});
