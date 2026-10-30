import Image from 'next/image';
import Link from 'next/link';
import type { Viewer } from '@/server/viewer';
import { SiteNav } from './site-nav';

export function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  return (
    <header className="site-header on-ink mx-3 mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-ink px-5 py-3 text-white sm:mx-4 sm:mt-4 sm:px-8 sm:py-4">
      <Link href="/" aria-label="xbul.io home" className="rounded-sm">
        {/* The full logo doesn't fit a phone's header beside the nav, so it drops the .io there. */}
        <Image src="/logos/xbul-logo-white.svg" alt="" width={137} height={40} className="max-sm:hidden" />
        <Image src="/logos/xbul-logo-short-white.svg" alt="" width={91} height={40} className="sm:hidden" />
      </Link>
      <SiteNav viewer={viewer} />
    </header>
  );
}
