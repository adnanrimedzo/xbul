import Link from 'next/link';
import type { Viewer } from '@/server/viewer';
import { Logo } from './logo';
import { SiteNav } from './site-nav';

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-8">
      <Link href="/" aria-label="xbul.io home" className="rounded-control">
        <Logo fit />
      </Link>
      <SiteNav viewer={viewer} />
    </header>
  );
}
