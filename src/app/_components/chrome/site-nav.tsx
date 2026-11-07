import Link from 'next/link';
import { signOutAction } from '@/app/_actions/sign-out';
import { LinkButton } from '@/app/_components/ui/button';
import { pageMessages } from '@/i18n/server';
import type { Viewer } from '@/server/viewer';
import { LanguageSwitcher } from './language-switcher';
import { CHROME } from './messages';
import { ModeSwitcher } from './mode-switcher';
import { ThemeToggle } from './theme-toggle';

const item = 'inline-flex min-h-11 items-center rounded-control text-sm text-muted transition-colors duration-150 hover:text-fg';

export async function SiteNav({ viewer }: { viewer: Viewer | null }) {
  const { t, href } = await pageMessages(CHROME);
  const company = viewer?.company;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      <nav aria-label={t.mainNav} className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {viewer?.mode === 'search' && <Link href={href('/brands')} className={item}>{t.brands}</Link>}
        {viewer?.mode === 'manufacturer' &&
          (company ? (
            <>
              <Link href={href(`/m/${company.slug}`)} className={item}>{t.myCompany}</Link>
              <Link href={href('/add')} className={item}>{t.addProducts}</Link>
            </>
          ) : (
            <Link href={href('/onboarding')} className={item}>{t.registerCompany}</Link>
          ))}
        {viewer?.mode === 'admin' && (
          <>
            <Link href={href('/admin/claims')} className={item}>{t.claims}</Link>
            <Link href={href('/admin/stats')} className={item}>{t.stats}</Link>
          </>
        )}
        {viewer ? (
          <>
            <ModeSwitcher viewer={viewer} />
            <form action={signOutAction}>
              <button type="submit" className={item}>{t.signOut}</button>
            </form>
          </>
        ) : (
          <>
            <Link href={href('/brands')} className={`${item} max-sm:hidden`}>{t.brands}</Link>
            <Link href={`${href('/')}#for-suppliers`} className={`${item} max-[400px]:hidden`}>{t.forSuppliers}</Link>
            <LinkButton variant="cta" size="sm" href={href('/sign-in')}>{t.signIn}</LinkButton>
          </>
        )}
      </nav>
      <div className="flex items-center">
        <LanguageSwitcher label={t.language} />
        <ThemeToggle />
      </div>
    </div>
  );
}
