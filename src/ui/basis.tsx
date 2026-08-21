/**
 * BasisMark — the basis colour+glyph pair as one primitive (R-UI-002).
 *
 * "each basis also has a glyph (◆ ▣ ƒ ⇩ ✎ ▦ ○) so it survives greyscale and
 * colour-blindness; the pair renders everywhere a basis appears (chips, table cells, sheet
 * overlays, documents)." This is the thing those surfaces adopt, so the pair is assembled
 * once: glyph and colour variable from BASIS, accessible name from the string table.
 *
 * Three signals, deliberately: the glyph alone distinguishes all seven in greyscale, the
 * colour reinforces it for everyone else, and `role="img"` with `aria-label` gives a screen
 * reader a name instead of a stray character (R-UI-060, J-004's axe pass).
 *
 * Size is not set: the mark inherits 1em from its host, so it scales with a chip, a 13 px
 * dense table cell or a document paragraph and never disturbs the 36/28 px row rhythm. Mono
 * keeps marks column-aligned down a table.
 */
import type { ReactElement } from 'react';
import { t } from './strings';
import type { StringKey } from './strings';
import { BASIS } from './tokens';
import type { BasisCode, BasisEntry } from './tokens';

/** The registered label of one basis, by the naming rule the table follows. */
const labelKey = (basis: BasisCode): StringKey =>
  `tokens.basis.${basis.toLowerCase() as Lowercase<BasisCode>}`;

export function BasisMark(props: { readonly basis: BasisCode }): ReactElement {
  // A code outside the fixed seven is a developer error, and it surfaces as one: a wrong
  // basis must never render as a plausible mark, because a reader cannot tell it from a
  // right one.
  const entry: BasisEntry | undefined = (BASIS as Readonly<Record<string, BasisEntry>>)[
    props.basis
  ];
  if (entry === undefined) throw new Error(`Unknown basis code: ${props.basis}`);

  return (
    <span
      data-testid="basis-mark"
      data-basis={props.basis}
      role="img"
      aria-label={t(labelKey(props.basis))}
      style={{ color: `var(${entry.cssVar})`, fontFamily: 'var(--font-mono)', lineHeight: 1 }}
    >
      {entry.glyph}
    </span>
  );
}
