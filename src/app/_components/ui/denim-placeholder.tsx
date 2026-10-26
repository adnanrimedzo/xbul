import type { ReactNode } from 'react';

// The mockup's denim twill with its jacket glyph. Size it with className; children render over the twill.
export function DenimPlaceholder({ className = '', children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`denim flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 200 220" aria-hidden="true" className="w-[42%] max-w-[220px] text-paper opacity-55">
        <path
          d="M62 28 L86 18 Q100 36 114 18 L138 28 L186 74 L168 134 L148 122 L148 206 L52 206 L52 122 L32 134 L14 74 Z M100 38 L100 206 M86 18 L92 70 M114 18 L108 70 M62 150 L86 150 M114 150 L138 150"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </div>
  );
}
