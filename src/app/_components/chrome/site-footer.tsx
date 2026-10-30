import Image from 'next/image';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="on-ink mx-3 mb-3 rounded-frame bg-ink px-6 py-10 text-white sm:mx-4 sm:mb-4 sm:px-10 sm:py-12">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-start justify-between gap-8">
        <div className="max-w-[40ch]">
          <Image src="/logos/xbul-logo-white.svg" alt="xbul.io" width={137} height={40} />
          <p className="mt-4">Find the supplier behind any product, then contact them directly. xbul.io takes no part in the deal.</p>
        </div>
        <ul className="flex flex-col gap-1">
          <li><Link href="/privacy" className="link">Privacy</Link></li>
          <li><Link href="/terms" className="link">Terms</Link></li>
          <li><a href="mailto:hello@xbul.io" className="link font-mono text-sm">hello@xbul.io</a></li>
        </ul>
      </div>
      <p className="mx-auto mt-10 max-w-[1120px] border-t border-white/20 pt-5 text-sm">© {new Date().getFullYear()} xbul.io</p>
    </footer>
  );
}
