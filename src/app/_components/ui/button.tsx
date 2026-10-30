import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';

const VARIANTS = {
  // Primary on light: ink with white text.
  cta: 'bg-ink py-2 pr-2 pl-6 text-white hover:bg-[#2b2d31]',
  // Primary on ink: light orange with ink text.
  onDark: 'bg-accent-dark py-2 pr-2 pl-6 text-ink hover:bg-white',
  ghost: 'border border-ink px-5 py-2 text-ink hover:bg-ink hover:text-white',
};
const DOT = { cta: 'bg-white text-ink', onDark: 'bg-ink text-white' };
type Variant = keyof typeof VARIANTS;

const classes = (variant: Variant, className: string) =>
  `inline-flex min-h-12 items-center justify-center gap-3 rounded-full font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-40 ${VARIANTS[variant]} ${className}`;

function Label({ variant, children }: { variant: Variant; children: ReactNode }) {
  if (variant === 'ghost') return children;
  return (
    <>
      {children}
      <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${DOT[variant]}`}>
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8h9M8 3.5 12.5 8 8 12.5" />
        </svg>
      </span>
    </>
  );
}

export function Button({ variant, className = '', children, ...props }: { variant: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classes(variant, className)} {...props}>
      <Label variant={variant}>{children}</Label>
    </button>
  );
}

export function LinkButton({ variant, className = '', children, ...props }: { variant: Variant } & ComponentProps<typeof Link>) {
  return (
    <Link className={classes(variant, className)} {...props}>
      <Label variant={variant}>{children}</Label>
    </Link>
  );
}
