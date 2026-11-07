import Image from 'next/image';

// The disc's check is drawn for each theme, so both files are rendered and CSS shows one.
function Disc({ size }: { size: number }) {
  return (
    <>
      <Image src="/logos/xbul-verified-light.svg" alt="" width={size} height={size} className="only-light shrink-0" />
      <Image src="/logos/xbul-verified-dark.svg" alt="" width={size} height={size} className="only-dark shrink-0" />
    </>
  );
}

// Always carries the words "evidence reviewed", and belongs to a supplier and product together. Green is used for nothing else.
export function VerifiedInline() {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <Disc size={16} />
      <span>Verified · evidence reviewed</span>
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-2">
      <Disc size={24} />
      <span className="flex flex-col leading-tight">
        <strong className="font-medium">Verified</strong>
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
