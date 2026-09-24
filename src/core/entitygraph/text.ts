// What a drawing's text SHOWS (L-CAD-02, L-CAD-08): the words a TEXT or MTEXT entity carries, with
// the codes that say HOW it is drawn taken away and the codes that stand for a glyph resolved to it —
// `%%c` is drawn Ø, `%%d` °, `%%p` ±, `\U+2212` −, `\S1/2;` 1/2.
//
// The artifact keeps every text byte for byte (L-CAD-08), and every reader of MEANING reads the
// notation (`./notation`), which also folds the diameter's lookalikes into one sign. This is the
// reading of APPEARANCE, and it is one reading whoever shows a text — the sheet's painter, the
// viewer's inspector and the schedule views all say a drawing's words through it, so `8-16%%C` is
// never `8-16Ø` on one surface and `8-16%%C` on the next (B-17). The `%%` table itself is the
// notation's (`resolveControlCodes`), and so is every MTEXT code (`mtextLines`, `resolveCodePoints`):
// what a code means is stated once, in `./notation`, and this file only chooses which reading a type takes.
//
// It keeps what the draughtsman typed: the case, the spacing and every glyph, a φ as a φ. Only the
// codes go, and an MTEXT's paragraphs become the lines they are drawn as.
import { mtextLines, resolveCodePoints, resolveControlCodes } from "./notation";

/** The DXF type whose text is a block of formatted paragraphs rather than one plain line. */
const MTEXT = "MTEXT";

/**
 * How far one line of an MTEXT stands beneath the line before it, in multiples of its own character
 * height: the DXF reference's default "3-on-5" spacing, five thirds of the height. The artifact
 * states no spacing factor (L-CAD-05 carries none), so the default is what was drawn.
 */
export const MTEXT_LINE_PITCH = 5 / 3;

/**
 * The LINES a text is drawn as, in the drawing's order. A TEXT is one line, its code point escapes
 * drawn as the characters they name; an MTEXT is its paragraphs as the one reading of an MTEXT's codes
 * cuts them (`mtextLines`: formatting taken away, stacks said on the line, escapes kept as the
 * characters they spell). Either way the `%%` control codes are then drawn as their glyphs. A blank
 * paragraph is still a line: it is drawn, as empty space, and a painter setting the lines beneath it
 * counts it.
 */
export function displayLines(text: string, type: string): string[] {
  if (type !== MTEXT) return [resolveControlCodes(resolveCodePoints(text))];
  return mtextLines(text).map(resolveControlCodes);
}

/**
 * A text as one string, for a surface that says it rather than paints it: its lines, joined by the
 * line break they are drawn with. A text whose type is not known is read as a plain TEXT — the codes
 * that stand for a glyph resolved, and nothing taken away that a plain line could mean.
 */
export function displayText(text: string, type = "TEXT"): string {
  return displayLines(text, type).join("\n");
}
