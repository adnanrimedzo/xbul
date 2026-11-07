import Link from 'next/link';
import { localePath } from '@/i18n/locales';
import { pageLang } from '@/i18n/server';
import type { Viewer } from '@/server/viewer';
import { Logo } from './logo';
import { SiteNav } from './site-nav';

export async function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  const lang = await pageLang();
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-8">
      <Link href={localePath(lang, '/')} aria-label={lang === 'tr' ? 'xbul.io ana sayfa' : 'xbul.io home'} className="rounded-control">
        <Logo fit />
      </Link>
      <SiteNav viewer={viewer} />
    </header>
  );
}
