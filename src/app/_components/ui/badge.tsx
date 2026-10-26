import type { ReactNode } from 'react';

const TONES = { accent: 'border-accent bg-accent text-paper', outline: 'border-ink' };

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`border px-1.5 py-0.5 text-[10px] ${TONES[tone]}`}>{children}</span>;
}
