import type { ReactNode } from 'react';

// Mockup .grid/.tile: 3 columns (2 below 760px), each tile ruled right and bottom except the row's last.
export function GarmentGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 border-t border-ink *:border-r *:border-b *:border-ink max-[760px]:grid-cols-2 min-[760px]:*:nth-[3n]:border-r-0 max-[760px]:*:nth-[2n]:border-r-0">
      {children}
    </div>
  );
}
