# Vextrus Logo — The Ascent (negative-V)

> **Status:** FINAL — approved by CEO 2026-05-24.
> **Supersedes:** "The Keystone V" (`.claude/creative/logo/dist/`, rejected by the team)
> AND the original rushed "The Ascent" (`docs/brand-identity.md §Logo`, `design-export/.../logos/`).
> **Brand colours:** unchanged — Deep Indigo + Warm Copper (OKLCh canonical in `docs/brand-identity.md`).

## 1. Concept

A single faceted **peak** (the Ascent — elevation, intelligence, precision) with an
**ownable negative V** carved into its body, and a small **copper intelligence spark**
above the apex.

This is the evolution the team asked for: keep the mark everyone loved (single
upward peak, faceted planes, copper spark, indigo→copper axis) and give it the one
thing the rushed original lacked — an **ownable letterform**. The V is *negative
space* (a true cut, edges shared with the planes — not a stamped font letter), so it
reads "is that a V… or just the form?" — discoverable, FedEx-style.

- **Peak / ascent** — elevation, growth, the climb.
- **Two faceted planes** — human + AI judgment (the 4-Eyes Principle), via a two-tone fold.
- **Negative V** — Vextrus, hidden in the structure (intelligence within the ascent).
- **Copper spark** — the spark of intelligence; the lone warm accent (a quiet nod to Claude's hue).

## 2. The mark — anatomy (viewBox `0 0 100 100`)

- **Left facet** `M50 9 L14 89 L50 66 Z` — deeper indigo.
- **Right facet** `M50 9 L86 89 L50 66 Z` — primary indigo (two-tone fold = one light source).
- **Single apex** at `(50,9)`: the peak is never split — one point (this is what keeps it
  from reading as an "M").
- **Negative V (band)** carved from the body, masked out (true cut):
  `M38 33 L50 61 L62 33 L56 33 L50 48 L44 33 Z` — sharp flat-cut terminals, mitered
  corners, edges aligned to the planes; sits well below the apex so nothing clusters
  into a "star".
- **Spark** — solid copper circle `cx 50 cy 5 r 3.2`, **no glow**. **Responsive:** shown
  ≥ 32 px; omitted below (favicon/micro), exactly as the original Ascent dropped its dot.

## 3. Colour

| Role | OKLCh (production) | sRGB (light) | sRGB (dark mode) |
|------|--------------------|--------------|------------------|
| Indigo deep (left facet) | `oklch(0.42 0.14 275)` | `#3A2F86` | `#564BA8` |
| Indigo primary (right facet) | `oklch(0.50 0.12 275)` | `#5A4FB0` | `#6E63C8` |
| Copper spark | `oklch(0.70 0.14 44)` | `#D88A55` | `#E29A68` |
| Cream (negative V on tile / reversed) | `oklch(0.975 0.005 70)` | `#F6F4F1` | `#F4F1EC` |

**Flat colours are the master** (print-identical, no banding). A per-plane-fold
*gradient* version may be used for hero/marketing only — same geometry. Copper is
scarce (spark only) — do not flood.

## 4. Wordmark & lockups

**Wordmark — lowercase `vextrus`.** Base face **Satoshi 700** for "extrus"; the leading
**v is a custom signature** — the *filled twin of the icon's balanced negative V*
(same geometry, brand-axis two-tone: indigo left arm + copper right arm). So the icon's
hidden V and the wordmark's v are one shape in two states (negative / positive).
- **Spacing (hand-tuned, option A):** v–e tight; "ex" snug (−1.5); a small **space at x–t**;
  **"trus" coupled** (−3.8) so it reads as a bound group — the quiet *trust* signal (no device).
- **Colour:** "extrus" Deep Indigo `#3A2F86`; signature v indigo+copper; mono = ink,
  reversed = cream. Flat (print-exact).

**Lockups** — **Symbol alone** (app icon/favicon/avatar) · **Horizontal** `[mark] vextrus`
(default) · **Stacked** (mark over vextrus). Mark vertically centred to the lowercase word.

**Portability:** exported wordmark/lockup SVGs **embed Satoshi (woff2, base64)** → fully
self-contained, render without the font installed (verified standalone in Chromium).
For an editor-native outline, run "Create Outlines" on "extrus" (the v is already paths).

## 5. Clear space, sizing, app icon

- **Clear space:** ≥ ½ mark height on all sides.
- **Min sizes:** mark 16px (favicon-proven, no-spark); horizontal lockup ≥ 104px wide.
- **App icon / favicon:** the indigo **tile** — `rounded-rect rx 20/100`, indigo
  gradient, cream peak, negative V shows the tile, small copper spark. Reads to 16px.

## 6. Monochrome

Ink (`#211910`), Indigo (`#5A4FB0`), Reversed (cream on dark). The negative V is a true
cut, so the mark survives in 1-bit (figure-ground holds without colour).

## 7. Usage

**Do** — keep the apex a single point; keep copper scarce (spark only, or the tile);
use flat for print; pair with Outfit (display) + Plus Jakarta Sans (body); drop the
spark below 32px.
**Don't** — split the peak into two (reads "M"); give the V its own outline / set it in
a font; add a glow to the spark; recolour the gradients; rotate/shadow/outline the mark.

## 8. Asset manifest (`.claude/creative/logo/final/dist/`)

**Mark:** `vextrus-mark.svg` (primary) · `-dark` · `-nospark` · `-ink` · `-indigo` ·
`-reversed` · `vextrus-tile.svg` (app icon) · `vextrus-favicon.svg`.
**Wordmark:** `vextrus-wordmark.svg` · `-mono` · `-reversed` (Satoshi embedded).
**Lockups:** `vextrus-lockup-h.svg` (horizontal) · `-h-dark` · `vextrus-lockup-stacked.svg`.

Source builders: `build-production.mjs` (mark) + `build-complete.mjs` (wordmark + lockups,
font-embed). Review sheet: `brand-sheet.html` / `build-complete.mjs` → `sheet/`.
Wordmark/lockup SVGs embed Satoshi (portable); the signature v is native paths.

## 9. Production follow-ups (post sign-off — separate from this build)

1. Replace `packages/ui/src/brand/vextrus-logo.tsx` + `apps/landing/components/ui/vextrus-logo.tsx`
   with this mark (OKLCh CSS-var version; responsive spark via `size >= 32`).
2. Update **`docs/brand-identity.md` §Logo** ("The Ascent" → "The Ascent (negative-V)").
3. Regenerate favicon PNG/ICO + `apple-touch-icon` from the tile; update `design-export/.../logos/`.
4. Outline the wordmark in the lockup SVGs for distribution.
