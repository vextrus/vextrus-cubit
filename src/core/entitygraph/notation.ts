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

/** The MTEXT paragraph mark: where a draughtsman ends one line of a block and begins the next (T-MTEXT-CODES). */
const MTEXT_PARAGRAPH = /\\P/g;

/**
 * An MTEXT code that carries a parameter and closes with a semicolon — the font run
 * `\fSwis721 Cn BT|b1|i0|c0|p34;`, the alignment `\A1;`, a height `\H2x;`, a colour `\C1;`. It says
 * how the text is DRAWN and nothing about what it means, so it goes (L-CAD-03: what the text SAYS
 * is kept).
 */
const MTEXT_PARAMETERISED_CODE = /\\[A-Za-z][^\\;{}]*;/g;

/** The formatting toggles an MTEXT switches underline (`\L…\l`), overline and strike-through with. */
const MTEXT_TOGGLES = /\\[LlOoKk]/g;

/** The braces an MTEXT groups a formatted run with, and the non-breaking space it spells `\~`. */
const MTEXT_GROUPS = /[{}]/g;
const MTEXT_HARD_SPACE = /\\~/g;

/**
 * The LINES an MTEXT's inline codes draw, in the drawing's own order: the text cut at every paragraph
 * mark, with the codes that say how it is drawn taken away and every word it says kept (L-CAD-02,
 * L-CAD-03, T-MTEXT-CODES). A text carrying no code is one line, itself — which is what a plain TEXT
 * entity is. A blank paragraph is still a line: it is drawn, as empty space, and a reader that
 * positions the lines beneath it counts it.
 *
 * The one home of what an MTEXT code IS (B-17): the note clauses a model is asked about and the
 * schedule reader both cut a block here. The `%%` control codes are NOT resolved — that is
 * `normaliseNotation`'s, and a reader that keeps a cell verbatim keeps them verbatim.
 */
export function mtextLines(text: string): string[] {
  return text
    .replace(MTEXT_PARAGRAPH, "\n")
    .replace(MTEXT_PARAMETERISED_CODE, "")
    .replace(MTEXT_TOGGLES, "")
    .replace(MTEXT_HARD_SPACE, " ")
    .replace(MTEXT_GROUPS, "")
    .split("\n");
}
