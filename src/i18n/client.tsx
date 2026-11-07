'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, localePath, type Locale } from './locales';

const LangContext = createContext<Locale>(DEFAULT_LOCALE);

export function LangProvider({ lang, children }: { lang: Locale; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = () => useContext(LangContext);

// Picks this language's copy of a defineMessages() object, plus a path helper for links.
export function useMessages<T>(messages: { en: T; tr: T }) {
  const lang = useLang();
  return { t: messages[lang], lang, href: (path: string) => localePath(lang, path) };
}
