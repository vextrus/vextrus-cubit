/**
 * The single home of R-UI-002's glyph table (B-17). Every chip, table cell, sheet overlay and
 * document that shows a basis reads its glyph from here, so the pair — colour plus glyph —
 * survives greyscale and colour-blindness wherever a basis appears.
 *
 * The colours are not here: a basis wears its own palette token, and a TypeScript module that
 * mapped a basis to a colour would be a second home for a value the token source already owns
 * (R-UI-001).
 */

/** R-UI-002's basis palette, in the clause's own order. */
export const BASIS_GLYPHS = {
  MEASURED: "◆",
  TRANSCRIBED: "▣",
  DERIVED: "ƒ",
  IMPORTED: "⇩",
  ENTERED: "✎",
  INTERPRETED: "▦",
  DEFAULTED: "○",
} as const satisfies Record<string, string>;

/** The seven bases R-UI-002 fixes, derived from the table rather than restated beside it. */
export type Basis = keyof typeof BASIS_GLYPHS;
