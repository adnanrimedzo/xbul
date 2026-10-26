import Link from 'next/link';
import { IstanbulClock } from './istanbul-clock';

export function SiteHeader() {
  return (
    <header className="flex items-end justify-between px-5 pt-3.5 pb-2.5">
      <Link href="/" className="text-[30px] font-bold tracking-[-0.02em]">
        xmanufacture
      </Link>
      <IstanbulClock />
    </header>
  );
}
