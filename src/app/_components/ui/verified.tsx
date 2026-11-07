import Image from 'next/image';
import { pageMessages } from '@/i18n/server';
import { UI } from './messages';

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
export async function VerifiedInline() {
  const { t } = await pageMessages(UI);
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium">
      <Disc size={16} />
      <span>{t.verifiedInline}</span>
    </span>
  );
}

export async function VerifiedBadge() {
  const { t } = await pageMessages(UI);
  return (
    <span className="inline-flex items-center gap-2">
      <Disc size={24} />
      <span className="flex flex-col leading-tight">
        <strong className="font-medium">{t.verified}</strong>
        <span className="text-sm text-muted">{t.evidenceReviewed}</span>
      </span>
    </span>
  );
}

// Shown near every Verified result, so nobody reads the badge as more than it is.
export async function VerifiedExplanation({ className = '' }: { className?: string }) {
  const { t } = await pageMessages(UI);
  return (
    <aside aria-label={t.whatVerifiedMeans} className={className}>
      <h2 className="section-title">{t.whatVerifiedMeans}</h2>
      <p className="mt-2 max-w-[70ch]">{t.verifiedBody}</p>
    </aside>
  );
}
