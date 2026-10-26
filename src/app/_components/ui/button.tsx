import type { ButtonHTMLAttributes } from 'react';

const VARIANTS = {
  // Mockup .cta: orange, white text. Add w-full where the mockup's button spans its panel.
  cta: 'bg-accent px-[18px] py-3 text-[12px] font-semibold text-paper',
  // Mockup .ghost: white with a 1px ink line.
  ghost: 'border border-ink bg-paper px-2.5 py-[7px] text-[11px] font-semibold whitespace-nowrap text-ink',
};

export function Button({ variant, className = '', ...props }: { variant: keyof typeof VARIANTS } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${VARIANTS[variant]} disabled:opacity-40 ${className}`} {...props} />;
}
