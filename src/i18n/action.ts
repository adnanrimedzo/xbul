import { headers } from 'next/headers';
import { DEFAULT_LOCALE, hasLocale, type Locale } from './locales';

// For server actions, which run as a POST to the page they were called from: that page's URL carries the language.
// Kept apart from server.ts, whose next/root-params import only resolves inside Next's own build.
export async function actionLang(): Promise<Locale> {
  const referer = (await headers()).get('referer');
  if (!referer) return DEFAULT_LOCALE;
  const first = new URL(referer).pathname.split('/')[1];
  return hasLocale(first) ? first : DEFAULT_LOCALE;
}
