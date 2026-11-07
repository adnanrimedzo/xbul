import { notFound } from 'next/navigation';
import { lang } from 'next/root-params';
import { hasLocale, localePath, type Locale } from './locales';

// The [lang] segment of the page being rendered. Server Components only (root params aren't readable in actions).
export async function pageLang(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

// This language's copy of a defineMessages() object, plus a path helper for links and redirects.
export async function pageMessages<T>(messages: { en: T; tr: T }) {
  const l = await pageLang();
  return { t: messages[l], lang: l, href: (path: string) => localePath(l, path) };
}
