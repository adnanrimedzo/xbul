const PHRASES = [
  'Find the mill behind any garment',
  'Paste a link, see who made the fabric',
  'Request swatches straight from the mill',
  'Free for buyers',
];

// Two identical halves, each wider than a wide screen, so translateX(-50%) loops without a seam.
const HALF = [...PHRASES, ...PHRASES].map((p) => `${p}  —  `).join('');

export function Ticker() {
  return (
    <div aria-hidden="true" className="overflow-hidden border-b border-ink py-[5px] text-[11px] whitespace-nowrap">
      <div className="inline-block animate-ticker motion-reduce:animate-none">
        {HALF}
        {HALF}
      </div>
    </div>
  );
}
