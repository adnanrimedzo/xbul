# xbul.io design rules

Version 2. Loupe logo. Full guide: `xbul-brand-guide.html`. Tokens: `xbul-tokens.css`.

## Essentials
- The name is xbul.io, always lowercase. Sentence case everywhere. No CSS `uppercase` (it breaks Turkish i/İ).
- Monochrome, in a light and a dark theme, with thin 1 px rules. Nothing is coloured unless it means something.
- One accent: orange `#BF3F0A` in light, `#FF7A3D` in dark. Only for links, the focus ring and one block of the hero art.
- Green (`#1B7F3B` in light, `#4FCB7A` in dark) is only for the Verified badge.

## Themes
The site follows the system setting. The header toggle cycles system, light and dark; a choice is saved in `localStorage` (`theme`) and set as `data-theme` on `<html>` by an inline script before the first paint.

Use the semantic colour tokens in `src/app/globals.css`, never raw hex or `white`/`black` (the one exception is the photo credit, which sits on a photo):

| Token | Light | Dark | For |
|---|---|---|---|
| `bg` | `#FCFCFC` | `#0B0B0C` | page, cards, inputs |
| `surface` | `#F4F4F4` | `#151516` | panels, placeholders, hover |
| `fg` | `#1A1A1A` | `#EDEDED` | text, tag lines |
| `muted` | `#6B6B6B` | `#9A9A9A` | secondary text, nav (at least 4.5:1 on `bg` and `surface`) |
| `line` | `#E4E4E4` | `#2A2A2C` | every rule and border |
| `inverse` / `on-inverse` | `#1A1A1A` / `#FFF` | `#EDEDED` / `#0B0B0C` | the solid button |
| `accent`, `verified` | see above | | |

Logo and badge files have their colours baked in, so render both copies with `.only-light` and `.only-dark`.

## Logo
Default `logos/xbul-logo-*`. Tight spaces `logos/xbul-logo-short-*` (no .io). Mark alone `logos/xbul-mark-*`. Favicon `logos/xbul-favicon.svg` is a separate, heavier drawing.

## Type
Space Grotesk 500 for headings, tracked tight (−0.045em on page titles, −0.06em on the hero). Inter 400/500 for body and UI, 16 px minimum. IBM Plex Mono 400/500 for tags, codes and contact links. Always load Latin Extended. Allow 30% extra length for Turkish.

## Layout
Spacing in multiples of 4 and 8. No shadows. Max content width 1120 px. Mobile first, no horizontal scrolling. Tap targets at least 44 px.

The look follows the Aoutive reference (https://aoutive.framer.website/): the page sits in a 1200 px `.frame` with hairlines left and right, and each full-width section is a `.band` with a top hairline and a "+" where it meets the side lines. Section heads are centred: a small muted `.eyebrow`, then the title. Radii are 4 px for buttons, inputs and tags (`rounded-control`) and 10 px for cards, panels and images (`rounded-card`). The home hero's art is a mosaic of grey blocks with one orange block.

## Components
- Buttons: `cta` is solid `inverse` with `on-inverse` text (hover 85% opacity), one per view. `ghost` is a `line` hairline with `fg` text (hover `surface`).
- Focus: 2 px `accent` outline, 2 px offset, in both themes.
- Motion: 150 to 200 ms for state changes. Respect reduced-motion.
- Tags: `We made this` (solid line), `Can make an equivalent` (dashed line). Plex Mono 14 px.

## Verified badge (critical)
- Solid green disc with a check. No ring, no handle, so it can't be confused with the logo.
- Always with the words "evidence reviewed". Attached to a supplier and product pair, never a supplier in general.
- Show the explanation near results: evidence was reviewed; documents stay private and are deleted after the decision; not a guarantee of quality, price or delivery.
- Paid badges and ranking must never use this disc or its colour.

## Copy
Direct, evidence first, respectful of makers. Never imply a guarantee or a broker. Avoid: trusted, certified, guaranteed, top-quality, request a quote, we'll connect you. No exclamation marks.
