import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

const VARIANTS = {
  // Solid: the one main action in a view.
  cta: 'bg-inverse text-on-inverse hover:opacity-85',
  // Hairline: everything else.
  ghost: 'border border-line text-fg hover:border-muted hover:bg-surface',
};
const SIZES = { md: 'min-h-12 px-5', sm: 'min-h-10 px-4 text-sm' };
type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;
type Style = { variant: Variant; size?: Size };

const classes = ({ variant, size = 'md' }: Style, className: string) =>
  `inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition duration-150 disabled:opacity-40 ${SIZES[size]} ${VARIANTS[variant]} ${className}`;

export function Button({ variant, size, className = '', ...props }: Style & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={classes({ variant, size }, className)} {...props} />;
}

export function LinkButton({ variant, size, className = '', ...props }: Style & ComponentProps<typeof Link>) {
  return <Link className={classes({ variant, size }, className)} {...props} />;
}
