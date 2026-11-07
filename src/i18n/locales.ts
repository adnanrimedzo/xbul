// Shared by the proxy, server and client code, so nothing here may import server-only modules.

export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

// The visitor's explicit choice. It beats the country guess, and only the switcher writes it.
export const LOCALE_COOKIE = 'lang';

export const hasLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

// English lives at the bare paths, Turkish under /tr. Both are real, crawlable URLs, so search engines index each language.
export function localePath(lang: Locale, path: string): string {
  if (lang === DEFAULT_LOCALE) return path;
  return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

// The same page in the other language: /tr/p/1 ↔ /p/1.
export function stripLocale(pathname: string): string {
  for (const l of LOCALES) {
    if (pathname === `/${l}`) return '/';
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

// Each module keeps its own strings, and TypeScript makes the Turkish copy match the English shape.
export const defineMessages = <T,>(messages: { en: T; tr: NoInfer<T> }) => messages;

export const HTML_LANG: Record<Locale, string> = { en: 'en', tr: 'tr' };
export const OG_LOCALE: Record<Locale, string> = { en: 'en_US', tr: 'tr_TR' };
