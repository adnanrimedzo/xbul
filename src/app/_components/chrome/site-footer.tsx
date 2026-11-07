import Link from 'next/link';
import { pageMessages } from '@/i18n/server';
import { LanguageSwitcher } from './language-switcher';
import { Logo } from './logo';
import { CHROME } from './messages';

const item = 'text-sm text-muted transition-colors duration-150 hover:text-fg';

export async function SiteFooter() {
  const { t, href } = await pageMessages(CHROME);
  return (
    <footer className="band px-5 pt-12 pb-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-10">
        <div className="max-w-[40ch]">
          <Logo />
          <p className="mt-4 text-sm text-muted">{t.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-x-16 gap-y-8">
          <div>
            <h2 className="text-sm font-medium">{t.explore}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              <li><Link href={href('/brands')} className={item}>{t.brands}</Link></li>
              <li><Link href={`${href('/')}#how-it-works`} className={item}>{t.howItWorks}</Link></li>
              <li><Link href={`${href('/')}#for-suppliers`} className={item}>{t.forSuppliers}</Link></li>
              <li><Link href={`${href('/')}#faq`} className={item}>{t.faq}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-medium">{t.site}</h2>
            <ul className="mt-3 flex flex-col gap-2">
              <li><Link href={href('/privacy')} className={item}>{t.privacy}</Link></li>
              <li><Link href={href('/terms')} className={item}>{t.terms}</Link></li>
              <li><a href="mailto:hello@xbul.io" className={`${item} font-mono`}>hello@xbul.io</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p className="text-sm text-muted">© {new Date().getFullYear()} xbul.io</p>
        <LanguageSwitcher label={t.language} />
      </div>
      <p className="mt-4 max-w-[80ch] text-xs text-muted">{t.brandNote}</p>
    </footer>
  );
}
