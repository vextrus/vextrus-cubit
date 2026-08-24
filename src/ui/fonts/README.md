# Datum v2 type — Spline Sans + Spline Sans Mono, vendored

Variable-weight woff2 (wght 300–700, normal style), latin + latin-ext subsets, fetched from
Google Fonts (Spline Sans v16, Spline Sans Mono v13) on 2026-08-24. Both families are licensed
under the SIL Open Font License 1.1 — the license texts sit beside the files
(`OFL-spline-sans.txt`, `OFL-spline-sans-mono.txt`). Build sessions run loopback-only and can
never fetch fonts at build or runtime; these files are the only lawful source (R-UI-003 as
amended by AM-05).

Weights the product uses (all inside the 300–700 variable range): sans 400/500/600/700,
mono 400/500/600. Keep `font-variant-numeric: tabular-nums slashed-zero` on the mono utility.

The tokens-and-fonts increment wires these via `@font-face` (or `next/font/local` with the same
files). The declarations, verbatim from the upstream css2 response with `src` re-pointed here:

```css
/* latin */
@font-face {
  font-family: 'Spline Sans';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('./spline-sans-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Spline Sans';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('./spline-sans-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Spline Sans Mono';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('./spline-sans-mono-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Spline Sans Mono';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url('./spline-sans-mono-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
```

Italic faces are deliberately not vendored: the handoff (§3) names normal-style weights only,
and the instrument voice does not use italics. If a Design Decision ever needs them, vendor
them the same way — never a runtime fetch.
