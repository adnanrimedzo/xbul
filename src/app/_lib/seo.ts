import type { Metadata } from 'next';
import { localePath, type Locale } from '@/i18n/locales';

// Canonical URL for this language, plus hreflang links to every language and an x-default (English, the bare path).
export function alternates(lang: Locale, path: string): NonNullable<Metadata['alternates']> {
  return {
    canonical: localePath(lang, path),
    languages: { en: localePath('en', path), tr: localePath('tr', path), 'x-default': localePath('en', path) },
  };
}

// schema.org data as a JSON-LD string. "<" is escaped so text from the database can't close the script tag.
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');
