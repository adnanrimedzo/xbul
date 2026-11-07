'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/i18n/client';
import { LOCALE_COOKIE, LOCALES, localePath, stripLocale } from '@/i18n/locales';

const NAMES = { en: 'English', tr: 'Türkçe' } as const;

// The visitor's language setting. Choosing one saves it for a year, and it then beats the country-based default.
export function LanguageSwitcher({ label }: { label: string }) {
  const lang = useLang();
  const path = stripLocale(usePathname());
  return (
    <nav aria-label={label} className="flex items-center gap-1 text-sm">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={localePath(l, path)}
          hrefLang={l}
          lang={l}
          aria-current={l === lang ? 'true' : undefined}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; SameSite=Lax`;
          }}
          className="inline-flex min-h-11 items-center rounded-control px-2 font-mono text-muted transition-colors duration-150 hover:text-fg aria-[current]:text-fg"
          title={NAMES[l]}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
