/**
 * The exact content of the committed `documents/base/palette.typ` (viewer.md Part 6, I-637): the
 * paper's palette for a document that paints what the sheet paints — the basis colours with their
 * glyphs (R-UI-002: the pair renders everywhere a basis appears, documents included) and the element
 * colours a condition wears (I-374). Paper is the light theme's, so the light values are emitted.
 *
 * Generated rather than typed, following `tokens.css`: every value is READ from its one home — the
 * colours from `tokens.ts`'s light table, the glyphs from `basis.ts` — so this file spells no colour
 * and no glyph, and the drift test holds the committed template byte-identical to this answer. Typst
 * reads no CSS variable, so without it a document would spell the palette a second time.
 *
 * Regenerate with: npx tsx -e 'import { writeFileSync } from "node:fs"; import { emitPaletteTyp } from
 * "./src/ui/palette-typ.ts"; writeFileSync("documents/base/palette.typ", emitPaletteTyp());'
 */
import { BASIS_GLYPHS } from "./primitives/core/basis";
import { lightTokens } from "./tokens";

const INDENT = "  ";
const ELEMENT = "--element-";

export function emitPaletteTyp(): string {
  const entry = (name: string, value: string): string => `${INDENT}${name}: ${value},`;
  // A colour crosses as the token's own hex string; a template paints it through Typst's colour
  // constructor at the point of use, so no colour function is spelled outside the token source.
  const colour = (token: string): string => JSON.stringify(lightTokens[token] ?? "");
  const bases = Object.keys(BASIS_GLYPHS) as (keyof typeof BASIS_GLYPHS)[];
  // The element palette in the order the token source emits it (R-UI-001).
  const elements = Object.keys(lightTokens).filter((token) => token.startsWith(ELEMENT));
  return [
    "// Generated from src/ui/tokens.ts and src/ui/primitives/core/basis.ts by src/ui/palette-typ.ts (R-UI-001, R-UI-002).",
    "// Edit the sources, never this file.",
    "//",
    "// The paper's palette: each basis's colour and glyph, and each element colour a condition wears.",
    "// Colours are the light theme's hex strings, painted through Typst's colour constructor where used.",
    "",
    "#let basis-colour = (",
    ...bases.map((basis) => entry(basis, colour(`--basis-${basis.toLowerCase()}`))),
    ")",
    "",
    "#let basis-glyph = (",
    ...bases.map((basis) => entry(basis, JSON.stringify(BASIS_GLYPHS[basis]))),
    ")",
    "",
    "#let element-colour = (",
    ...elements.map((token) => entry(token.slice(ELEMENT.length), colour(token))),
    ")",
    "",
  ].join("\n");
}
