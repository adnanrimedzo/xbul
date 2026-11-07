import type { CSSProperties } from 'react';
import { pageMessages } from '@/i18n/server';
import { HOME } from './home-messages';

// The hero's story in one loop: a product assembles from blocks, the xbul loupe passes over it, and lines draw out to
// the suppliers behind it. Pure SVG and CSS (globals.css .scene-*); with reduced motion it rests on the final frame.

// A jacket, 15 × 14 blocks. X is cloth, o a darker block (collar, pockets, cuffs), a the one orange block (a button).
const JACKET = [
  '....ooo.ooo....',
  '..XXXXX.XXXXX..',
  '.XXXXXX.XXXXXX.',
  'XXXXXXX.XXXXXXX',
  'XXXoooX.XoooXXX',
  'XX.XXXXaXXXX.XX',
  'XX.XXXX.XXXX.XX',
  'XX.XXXX.XXXX.XX',
  'XX.XXXXXXXXX.XX',
  'XX.XXXX.XXXX.XX',
  'XX.XXXX.XXXX.XX',
  'oo.XXXX.XXXX.oo',
  '...ooooXoooo...',
  '...XXXXXXXXX...',
];
const CELL = 18;
const STEP = 20;
const LEFT = 350; // the jacket spans x 350–650 of the 1000-wide scene
const TOP = 50;

const BLOCKS = JACKET.flatMap((row, y) =>
  [...row].flatMap((c, x) => (c === '.' ? [] : [{ x: LEFT + x * STEP, y: TOP + y * STEP, c, delay: ((x * 7 + y * 13) % 17) * 90 + y * 40 }])),
);

// Where each supplier card sits (as % of the scene) and where its line leaves the jacket.
const CARDS = [
  { key: 'fabric', box: 'sm:left-[2%] sm:top-[16%]', from: [350, 150], to: [262, 120] },
  { key: 'maker', box: 'sm:right-[2%] sm:top-[10%]', from: [650, 130], to: [738, 98] },
  { key: 'equivalent', box: 'sm:right-[2%] sm:top-[58%]', from: [650, 270], to: [738, 262] },
] as const;

export async function HeroScene() {
  const { t } = await pageMessages(HOME);
  const s = t.scene;
  const cards = {
    fabric: { title: s.fabric, place: 'Bursa, TR', tag: s.madeThis, dashed: false, verified: false },
    maker: { title: s.sewing, place: 'İstanbul, TR', tag: s.madeThis, dashed: false, verified: true },
    equivalent: { title: s.sewing, place: 'Denizli, TR', tag: s.canMake, dashed: true, verified: false },
  };

  return (
    <div aria-hidden="true" className="relative mt-16 w-full max-w-[1000px] sm:mt-20">
      {/* On a phone the cards stack below, so the drawing is cropped to the jacket's middle 40%. */}
      <div className="max-sm:overflow-hidden">
      <svg viewBox="0 0 1000 380" className="block w-full max-sm:-ml-[75%] max-sm:w-[250%] max-sm:max-w-none" fill="none">
        {CARDS.map(({ key, from, to }, i) => (
          <g key={key} className="max-sm:hidden">
            <path d={`M${from[0]} ${from[1]} C ${(from[0] + to[0]) / 2} ${from[1]}, ${(from[0] + to[0]) / 2} ${to[1]}, ${to[0]} ${to[1]}`} pathLength={1} className="scene-line stroke-muted" strokeWidth="1.25" style={{ '--d': i * 250 } as CSSProperties} />
            <circle cx={from[0]} cy={from[1]} r="3.5" className="scene-node fill-fg" style={{ '--d': i * 250 } as CSSProperties} />
          </g>
        ))}
        {BLOCKS.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={CELL}
            height={CELL}
            className={`scene-pixel ${b.c === 'a' ? 'fill-accent' : b.c === 'o' ? 'fill-muted/45' : 'fill-line'}`}
            style={{ '--d': b.delay } as CSSProperties}
          />
        ))}
        {/* The xbul loupe: a ring with a cross, and the orange handle. */}
        <g className="scene-loupe">
          <circle cx="500" cy="175" r="54" className="fill-bg/40 stroke-fg" strokeWidth="9" />
          <path d="M478 153 522 197M522 153 478 197" className="stroke-fg" strokeWidth="9" strokeLinecap="round" />
          <path d="M540 215 578 253" className="stroke-accent" strokeWidth="13" strokeLinecap="round" />
        </g>
      </svg>
      </div>

      <ul className="mt-6 grid gap-2 sm:absolute sm:inset-0 sm:mt-0 sm:block">
        {CARDS.map(({ key, box }, i) => {
          const c = cards[key];
          return (
            <li
              key={key}
              className={`scene-card flex flex-col items-start gap-1.5 rounded-card border border-line bg-bg px-4 py-3 text-left sm:absolute sm:w-[24%] ${box}`}
              style={{ '--d': i * 250 } as CSSProperties}
            >
              <span className={`rounded-control border px-1.5 py-0.5 font-mono text-[11px] leading-tight ${c.dashed ? 'border-dashed border-fg' : 'border-fg'}`}>{c.tag}</span>
              <span className="text-sm font-medium">{c.title}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                {c.place}
                {c.verified && (
                  <span className="inline-flex items-center gap-1 text-fg">
                    <span className="size-2 rounded-full bg-verified" />
                    {s.verified}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
