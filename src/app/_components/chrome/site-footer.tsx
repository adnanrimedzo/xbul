import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap justify-between gap-x-5 gap-y-1 border-t border-ink px-5 py-3 text-[11px]">
      <span>xbul</span>
      <span className="flex gap-3">
        <Link href="/privacy" className="border-b border-ink">Privacy</Link>
        <Link href="/terms" className="border-b border-ink">Terms</Link>
      </span>
      <span>© {new Date().getFullYear()}</span>
    </footer>
  );
}
