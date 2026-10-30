import Image from 'next/image';

// Always carries the words "evidence reviewed", and belongs to a supplier and product together. Green is used for nothing else.
export function VerifiedInline() {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold">
      <Image src="/logos/xbul-verified-light.svg" alt="" width={16} height={16} className="shrink-0" />
      <span>Verified · evidence reviewed</span>
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/logos/xbul-verified-light.svg" alt="" width={24} height={24} className="shrink-0" />
      <span className="flex flex-col leading-tight">
        <strong className="font-semibold">Verified</strong>
        <span className="text-sm text-muted">Evidence reviewed</span>
      </span>
    </span>
  );
}

// Shown near every Verified result, so nobody reads the badge as more than it is.
export function VerifiedExplanation({ className = '' }: { className?: string }) {
  return (
    <aside aria-label="What Verified means" className={className}>
      <h2 className="section-title">What Verified means</h2>
      <p className="mt-2 max-w-[70ch]">
        xbul.io reviewed evidence, such as invoices or correspondence, that this supplier made this product. The documents stay private and are deleted after the decision. It isn&apos;t a
        guarantee of quality, price or delivery.
      </p>
    </aside>
  );
}
