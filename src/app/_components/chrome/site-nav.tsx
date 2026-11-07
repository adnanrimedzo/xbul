import Link from 'next/link';
import { signOutAction } from '@/app/_actions/sign-out';
import { LinkButton } from '@/app/_components/ui/button';
import type { Viewer } from '@/server/viewer';
import { ThemeToggle } from './theme-toggle';

const item = 'inline-flex min-h-11 items-center rounded-control text-sm text-muted transition-colors duration-150 hover:text-fg';

export function SiteNav({ viewer }: { viewer: Viewer | null }) {
  const company = viewer?.company;
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {company && (
        <>
          <Link href={`/m/${company.slug}`} className={item}>My company</Link>
          <Link href="/add" className={item}>Add products</Link>
        </>
      )}
      {viewer?.isAdmin && (
        <>
          <Link href="/admin/claims" className={item}>Admin</Link>
          <Link href="/admin/stats" className={item}>Stats</Link>
        </>
      )}
      {viewer ? (
        <form action={signOutAction}>
          <button type="submit" className={item}>Sign out</button>
        </form>
      ) : (
        <>
          <Link href="/#for-suppliers" className={`${item} max-[400px]:hidden`}>For suppliers</Link>
          <LinkButton variant="cta" size="sm" href="/sign-in">Sign in</LinkButton>
        </>
      )}
      <ThemeToggle />
    </nav>
  );
}
