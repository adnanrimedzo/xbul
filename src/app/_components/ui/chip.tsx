import type { ReactNode } from 'react';

export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-control border border-line bg-bg px-2.5 py-1 font-mono text-sm">{children}</span>;
}
