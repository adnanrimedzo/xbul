import Link from 'next/link';
import { signOutAction } from '@/app/_actions/sign-out';
import type { Viewer } from '@/server/viewer';

const group = 'flex gap-7 max-[760px]:gap-3.5';

export function SiteNav({ viewer }: { viewer: Viewer | null }) {
  const company = viewer?.company;
  return (
    <nav aria-label="Main" className="flex flex-wrap justify-between gap-x-7 gap-y-2 border-y border-ink px-5 py-2.5 text-[12px] font-medium">
      <div className={group}>
        <Link href="/">Search</Link>
        {/* Phase 1 has no mills directory, so Mills is the viewer's own mill page and only mills see it. */}
        {company && <Link href={`/m/${company.slug}`}>Mills</Link>}
      </div>
      <div className={group}>
        {company && <Link href="/add">Add garment</Link>}
        {viewer?.isAdmin && <Link href="/admin/claims">Admin</Link>}
        {viewer ? (
          <form action={signOutAction}>
            <button type="submit">Sign out</button>
          </form>
        ) : (
          <Link href="/sign-in">Sign in</Link>
        )}
      </div>
    </nav>
  );
}
