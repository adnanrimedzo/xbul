import Link from 'next/link';
import { Logo } from './logo';

const item = 'text-sm text-muted transition-colors duration-150 hover:text-fg';

export function SiteFooter() {
  return (
    <footer className="band px-5 pt-12 pb-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-10">
        <div className="max-w-[40ch]">
          <Logo />
          <p className="mt-4 text-sm text-muted">Find the supplier behind any product, then contact them directly. xbul.io takes no part in the deal.</p>
        </div>
        <div>
          <h2 className="text-sm font-medium">Site</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <li><Link href="/privacy" className={item}>Privacy</Link></li>
            <li><Link href="/terms" className={item}>Terms</Link></li>
            <li><a href="mailto:hello@xbul.io" className={`${item} font-mono`}>hello@xbul.io</a></li>
          </ul>
        </div>
      </div>
      <p className="mt-12 text-sm text-muted">© {new Date().getFullYear()} xbul.io</p>
    </footer>
  );
}
