import Link from 'next/link';
import { signOutAction } from '@/app/_actions/sign-out';
import { LinkButton } from '@/app/_components/ui/button';
import type { Viewer } from '@/server/viewer';

const item = 'inline-flex min-h-11 items-center rounded-sm font-semibold transition-colors duration-150 hover:text-accent-dark';

export function SiteNav({ viewer }: { viewer: Viewer | null }) {
  const company = viewer?.company;
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-1">
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
          <LinkButton variant="onDark" href="/sign-in">Sign in</LinkButton>
        </>
      )}
    </nav>
  );
}
