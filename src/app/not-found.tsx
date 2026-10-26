import Link from 'next/link';

// Rendered inside the root layout, so a missing page keeps the site chrome.
export default function NotFound() {
  return (
    <div className="px-5 pt-7 pb-10">
      <h1 className="text-[64px] leading-[0.9] font-bold tracking-[-0.02em] max-[760px]:text-[44px]">Not found</h1>
      <p className="mt-3 text-[12px] normal-case">This page doesn&apos;t exist, or it has been removed.</p>
      <Link href="/" className="mt-[18px] inline-block border-b border-ink text-[12px] font-semibold">
        ← Back to xmanufacture
      </Link>
    </div>
  );
}
