# xbul.io design rules

Version 2. Loupe logo. Full guide: `xbul-brand-guide.html`. Tokens: `xbul-tokens.css`.

## Essentials
- The name is xbul.io, always lowercase. Sentence case everywhere. No CSS `uppercase` (it breaks Turkish i/İ).
- Screens are ink on paper or white, with thin 1 px rules. Dark bands are ink.
- One accent: orange `#BF3F0A` on light, `#FF7A3D` on ink. Use it sparingly.
- Green (`#1B7F3B`, `#4FCB7A` on ink) is only for the Verified badge.

## Logo
Default `logos/xbul-logo-*`. Tight spaces `logos/xbul-logo-short-*` (no .io). Mark alone `logos/xbul-mark-*`. Favicon `logos/xbul-favicon.svg` is a separate, heavier drawing.

## Type
Archivo 700/800 for headlines, 400/600 for body and UI, 16 px minimum. IBM Plex Mono 400/500 for tags and links. Always load Latin Extended. Allow 30% extra length for Turkish.

## Layout
Spacing in multiples of 4 and 8. No shadows. Max content width 1120 px. Mobile first, no horizontal scrolling. Tap targets at least 44 px.

Shapes follow the Optivio reference (https://optivio.framer.website/), replacing the guide's 4 px radius: inset dark frames for the header, hero and footer (40 px radius), paper panels (32 px) holding white cards (24 px), pill buttons and search bar. Tokens are in `src/app/globals.css`.

## Components
- Primary button on light: ink background, white text; hover dark grey. On ink: light orange background, ink text; hover white background.
- Focus: 2 px outline, ink on light and white on dark, 2 px offset.
- Motion: 150 to 200 ms for state changes. Respect reduced-motion.
- Tags: `We made this` (solid line), `Can make an equivalent` (dashed line). Plex Mono 14 px.

## Verified badge (critical)
- Solid green disc with a check. No ring, no handle, so it can't be confused with the logo.
- Always with the words "evidence reviewed". Attached to a supplier and product pair, never a supplier in general.
- Show the explanation near results: evidence was reviewed; documents stay private and are deleted after the decision; not a guarantee of quality, price or delivery.
- Paid badges and ranking must never use this disc or its colour.

## Copy
Direct, evidence first, respectful of makers. Never imply a guarantee or a broker. Avoid: trusted, certified, guaranteed, top-quality, request a quote, we'll connect you. No exclamation marks.
