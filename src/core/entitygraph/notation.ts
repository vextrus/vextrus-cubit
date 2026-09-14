// L-CAD-02's text, as the glyphs a draughtsman typed resolve to: the DXF control codes a TEXT or
// MTEXT entity carries, and the many signs one diameter is written with.
//
// It stands in core because two readers of a drawing's own words need it and they sit in different
// layers: the schedule notation (`src/modules/takeoff/partition/notation`, which re-publishes this
// function) and the note grammar behind TRANSCRIBE_SHEET_NOTES (`src/core/notes/grammar.ts`), which
// is core and may not reach a module (ARCH-01). A second control-code table would be two answers to
// what `%%d` says (B-17).
//
// What a text SAYS is kept: the case, the spacing and the marks are the drawing's own, and a cell or
// a note is stored verbatim beside whatever was read out of it (L-CAD-03).

/**
 * The control codes a DXF text carries, and what each of them says (L-CAD-02). `%%%` stands first
 * because it is a longer code beginning with the same two characters as the rest.
 */
const CONTROL_CODES: readonly (readonly [RegExp, string])[] = Object.freeze([
  [/%%%/g, "%"],
  [/%%[Cc]/g, "Ø"],
  [/%%[Dd]/g, "°"],
  [/%%[Pp]/g, "±"],
  // The formatting toggles say how the text is drawn and nothing about what it means, so they go.
  [/%%[UuOoKk]/g, ""],
] as const);

/** Every glyph a draughtsman writes the diameter sign with. One notation, however it was typed. */
const DIAMETER_LOOKALIKES = /[φΦϕøØ⌀∅]/g;

/** The diameter sign itself. */
export const DIAMETER = "Ø";

/**
 * One text as the notation reads it: the control codes resolved, and every lookalike of the diameter
 * sign written as the one sign.
 */
export function normaliseNotation(text: string): string {
  let said = text;
  for (const [code, meaning] of CONTROL_CODES) said = said.replace(code, meaning);
  return said.replace(DIAMETER_LOOKALIKES, DIAMETER);
}
