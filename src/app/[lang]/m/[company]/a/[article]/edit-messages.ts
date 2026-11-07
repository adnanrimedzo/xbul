import { defineMessages } from '@/i18n/locales';

// The specs form's strings. Kept apart from messages.ts, which belongs to the article page.
export const EDIT_SPECS = defineMessages({
  en: {
    edit: 'Edit specs',
    weight: 'Weight',
    weightPlaceholder: '12.5 oz or 240 g/m²',
    composition: 'Composition',
    finish: 'Finish',
    moq: 'MOQ',
    moqPlaceholder: '1,000 m or 500 pieces',
    leadTime: 'Lead time (weeks)',
    saved: 'Specs saved.',
    save: 'Save specs',
  },
  tr: {
    edit: 'Özellikleri düzenle',
    weight: 'Gramaj',
    weightPlaceholder: '12,5 oz veya 240 g/m²',
    composition: 'Kompozisyon',
    finish: 'Apre',
    moq: 'MOQ',
    moqPlaceholder: '1.000 m veya 500 adet',
    leadTime: 'Termin süresi (hafta)',
    saved: 'Özellikler kaydedildi.',
    save: 'Özellikleri kaydet',
  },
});
