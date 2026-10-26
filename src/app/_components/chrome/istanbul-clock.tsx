'use client';

import { useSyncExternalStore } from 'react';
import { formatClock } from './format-clock';

const everySecond = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};

export function IstanbulClock() {
  // The server snapshot keeps hydration stable; the client swaps in the live time straight after.
  const time = useSyncExternalStore(everySecond, () => formatClock(new Date()), () => '--:--:--');
  return (
    <div className="text-right text-[11px] leading-[1.2]">
      Istanbul, TR
      <span className="block text-[20px] font-medium">{time}</span>
    </div>
  );
}
