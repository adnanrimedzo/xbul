'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useMessages } from '@/i18n/client';
import { UI } from './messages';

// Size it with className (e.g. aspect-[4/5]); the photo or the placeholder fills that box.
export function GarmentImage({ src, alt, credit, className = '' }: { src: string | null; alt: string; credit?: { host: string; href?: string }; className?: string }) {
  const { t } = useMessages(UI);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = src !== null && failedSrc !== src;
  return (
    <div className={`relative overflow-hidden bg-surface ${className}`} role={showPhoto ? undefined : 'img'} aria-label={showPhoto ? undefined : alt}>
      {showPhoto ? (
        // Brand hosts are arbitrary and we hotlink without re-hosting, so next/image's optimizer can't be used.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
          // An image that failed before hydration never fires onError, so check once it is attached.
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
          }}
        />
      ) : (
        <Image src="/logos/xbul-mark-mono.svg" alt="" width={64} height={64} className="absolute top-1/2 left-1/2 w-1/4 max-w-16 -translate-x-1/2 -translate-y-1/2 opacity-20 dark:invert" />
      )}
      {/* The credit names the photo's source, so the placeholder gets none. */}
      {/* Without an href it is plain text: a link here would nest an <a> inside a tile's link. */}
      {credit && showPhoto && (credit.href ? (
        <a href={credit.href} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 left-3 rounded-control bg-black/60 px-2.5 py-1 font-mono text-sm text-white backdrop-blur-sm">
          {t.photo}: {credit.host} ↗
        </a>
      ) : (
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-control bg-black/60 px-2 py-0.5 font-mono text-xs text-white backdrop-blur-sm">{t.photo}: {credit.host}</span>
      ))}
    </div>
  );
}
