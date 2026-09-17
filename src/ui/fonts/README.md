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

## The document seam's faces — static TTF instances

The woff2 files above are for the BROWSER. The document seam (SEAM-DOC, `src/core/documents`) needs
the same families as static TTF instances, and cannot use the woff2 files at all, for two reasons the
pinned renderer imposes:

- Typst 0.15.1's font loader admits `ttf`/`otf`/`ttc`/`otc` and nothing else, so `--font-path` finds
  no face in a directory of woff2.
- Typst takes a variable font as its DEFAULT instance and offers no weight axis, so a semibold that
  is not its own file renders as regular.

So three static instances are vendored beside the woff2, under the names the seam reads them by
(`DOCUMENT_FONT_FILES`, `src/core/documents/fonts.ts`). They were fetched on 2026-09-16 from the
upstream Sorkin Type repositories (`SorkinType/SplineSans` and `SorkinType/SplineSansMono`,
`fonts/ttf/`), under the same OFL 1.1 as the woff2:

| file | upstream | family the templates set | sha256 | licence beside it |
| --- | --- | --- | --- | --- |
| `spline-sans-regular.ttf` | `SplineSans-Regular.ttf` | `Spline Sans` | `7313ca24903fbdee49a9a20c551f213dfaf86a2ced1948e71e919ef899960674` | `OFL-spline-sans.txt` |
| `spline-sans-semibold.ttf` | `SplineSans-SemiBold.ttf` | `Spline Sans` | `10b3c62d5cc50fac8c76d9478d18b065f86af4490f9bea256d4be66dd8ab769a` | `OFL-spline-sans.txt` |
| `spline-sans-mono-regular.ttf` | `SplineSansMono-Regular.ttf` | `Spline Sans Mono` | `79384820b543bd4f52dff46c2da4ddca4bb5131ee3bcba4a6d17a5609351a098` | `OFL-spline-sans-mono.txt` |

`typst fonts --font-path src/ui/fonts --ignore-system-fonts` lists `Spline Sans` and
`Spline Sans Mono`. The web UI keeps using the woff2 faces; these three are for document rendering
only.

Each is pinned by the sha256 of its own bytes, computed at render time and recorded on every
`documents` row (`font_hashes`) — which is what makes "the same payload renders byte-identical"
checkable rather than merely promised (L-FMT-03, AM-08). The licence texts already beside the woff2
cover these instances too: same families, same OFL 1.1.

The repertoire a DOCUMENT is judged against is each face's own `cmap`, read out of the file, and not
`src/core/format.ts`'s static ranges — those say what this product's copy is written in, which is a
wider set. A code point the ranges admit but no vendored face maps (`U+0995`, say) refuses
`CHARACTER_NOT_COVERED` rather than printing a blank box (L-FMT-02).

Vendored by the founder, as the woff2 were: sessions run loopback-only and can never fetch a font
(C-07, B-24). Replacing or adding a face changes every rendered document's bytes, so it is a
`toolchain`-tagged increment that re-baselines `tests/docs/**/golden.pdf` in the same commit.
