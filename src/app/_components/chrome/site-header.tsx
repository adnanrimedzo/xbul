import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="flex px-5 pt-3.5 pb-2.5">
      <Link href="/" className="text-[30px] font-bold tracking-[-0.02em]">
        xbul
      </Link>
    </header>
  );
}
