'use client';

import { useState } from 'react';
import { DenimPlaceholder } from './denim-placeholder';

// Size it with className (e.g. aspect-[4/5]); the photo or twill fills that box.
export function GarmentImage({ src, alt, credit, className = '' }: { src: string | null; alt: string; credit?: { host: string; href: string }; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = src !== null && failedSrc !== src;
  return (
    <div className={`relative overflow-hidden ${className}`} role={showPhoto ? undefined : 'img'} aria-label={showPhoto ? undefined : alt}>
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
        <DenimPlaceholder className="absolute inset-0" />
      )}
      {credit && (
        <a href={credit.href} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 left-2.5 bg-ink px-1.5 py-0.5 text-[10px] text-paper">
          Photo: {credit.host} ↗
        </a>
      )}
    </div>
  );
}
