import type { ReactNode } from 'react';

export function Chip({ children }: { children: ReactNode }) {
  return <span className="border border-ink px-2 py-1 text-[11px]">{children}</span>;
}
