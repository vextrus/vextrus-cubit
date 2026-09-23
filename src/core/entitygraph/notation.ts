// L-CAD-02's text, as the glyphs a draughtsman typed resolve to: the MTEXT inline codes a text is
// drawn with, the DXF control codes a TEXT or MTEXT entity carries, and the many signs one diameter
// is written with.
//
// It stands in core because every reader of a drawing's own words needs it and they sit in different
// layers: the schedule notation (`src/modules/takeoff/partition/notation`, which re-publishes these
// functions, and its grammar table), the member marks and the level words read through that barrel,
// and the note grammar behind TRANSCRIBE_SHEET_NOTES (`src/core/notes`), which is core and may not
// reach a module (ARCH-01). A second code table would be two answers to what `%%d` or `\S1/2;` says,
// and two answers disagree (B-17: the partition grammar kept a stacked fraction this file deleted).
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

/** A character spelled by its three-digit decimal code — `%%176` — the older control code AutoCAD still draws. */
const DECIMAL_CODE = /%%(\d{3})/g;

/** The characters a `%%nnn` code may spell: the printable ones, delete excepted. Any other is no glyph. */
const PRINTABLE: readonly [number, number] = [32, 255];
const DELETE = 127;

/** A character spelled `%%nnn`, or the code as written where it names no printable character. */
function decimalCode(code: string, digits: string): string {
  const value = Number(digits);
  return value >= PRINTABLE[0] && value <= PRINTABLE[1] && value !== DELETE ? String.fromCharCode(value) : code;
}

/**
 * One text with its `%%` control codes resolved and nothing else touched: the table above, then a
 * `%%nnn` character code (after `%%%`, so `%%%176` is a percent sign and the figure 176). What a
 * control code means is stated here and nowhere else (B-17): the notation reads through it below,
 * and what a drawing SHOWS reads through it too.
 */
export function resolveControlCodes(text: string): string {
  let said = text;
  for (const [code, meaning] of CONTROL_CODES) said = said.replace(code, meaning);
  return said.replace(DECIMAL_CODE, decimalCode);
}

/** Every glyph a draughtsman writes the diameter sign with. One notation, however it was typed. */
const DIAMETER_LOOKALIKES = /[φΦϕøØ⌀∅]/g;

/** The diameter sign itself. */
export const DIAMETER = "Ø";

/** Where an MTEXT inline code begins: the backslash every one of them opens with. A text holding none
 * carries no code, and is read exactly as it was drawn — braces and all (I-330). */
const INLINE_CODE = "\\";

/** A code point spelled as a DXF escape, four hex digits after `\U+` — `\U+2212` is −. A TEXT and an
 * MTEXT alike draw it as the character. The digits are its one capture. */
const CODE_POINT = String.raw`[Uu]\+([0-9A-Fa-f]{4})`;

/**
 * The MTEXT inline codes, as ONE pattern read in one pass, so a character the draughtsman escaped —
 * or spelled as a code point — is never read a second time as a code (T-MTEXT-CODES, Interpretation
 * I-458). Each alternative captures what its code says:
 *   1. `\\`, `\{`, `\}` — the character itself, escaped;
 *   2–4. `\Sa/b;`, `\Sa#b;`, `\Sa^b;` — a STACK: its upper part, its divider and its lower part;
 *   5. `\P` (paragraph), `\N` (column), `\X` (a dimension's line below) — a line break;
 *   6. `\~` — the non-breaking space;
 *   7. `\U+2212` — a code point: the character it names;
 * and, capturing nothing because each only says how the text is drawn:
 *   `\A1;`, `\C1;`, `\c6710371;`, `\fSwis721 Cn BT|b1|i0|c0|p34;`, `\F…;`, `\H0.7x;`, `\Q15;`,
 *   `\T1.35;`, `\W0.8;`, `\pxqc;` — a code with a parameter closed by a semicolon. The parameter may
 *   cross no backslash, brace or semicolon, so a run of the text's own words is never taken for one
 *   (`\LSECTION A-A; SEE S-12` keeps its words);
 *   `\L…\l`, `\O…\o`, `\K…\k` — the underline, overline and strike toggles;
 *   a brace, outside any code, that opens or closes a formatted group.
 */
const MTEXT_CODE = new RegExp(
  String.raw`\\(?:([\\{}])|S([^;\\]*?)([/#^])([^;\\]*?);|([PNX])|(~)|${CODE_POINT}|[ACcFfHQTWp][^\;{}]*;|[LlOoKk])|[{}]`,
  "g",
);

/** A code point escape alone, for a TEXT — which draws no MTEXT code but does draw the character. */
const CODE_POINT_ESCAPE = new RegExp(String.raw`\\${CODE_POINT}`, "g");

/** The surrogate halves (U+D800 to U+DFFF), which name no character on their own. */
const SURROGATES: readonly [number, number] = [0xd800, 0xdfff];

/** A code point as the character it names, or the escape as written where it names none. */
function codePointSaid(escape: string, hex: string): string {
  const value = Number.parseInt(hex, 16);
  if (!Number.isInteger(value) || (value >= SURROGATES[0] && value <= SURROGATES[1])) return escape;
  return String.fromCodePoint(value);
}

/**
 * A TEXT's code point escapes resolved to the characters they name, and nothing else touched: a TEXT
 * draws no MTEXT code, so its `\P` is a backslash and a letter (L-CAD-02).
 */
export function resolveCodePoints(text: string): string {
  return text.includes(INLINE_CODE) ? text.replace(CODE_POINT_ESCAPE, codePointSaid) : text;
}

/** The one divider that stacks a part over another without a fraction bar: a tolerance, or a figure
 * raised or lowered beside the text. The other two, `/` and `#`, draw a fraction's bar. */
const TOLERANCE_STACK = "^";

/** A reading that ends in a figure, which a stack after it must stand apart from. */
const ENDS_IN_A_FIGURE = /\d$/;

/**
 * What a stack says, as a reader reads it on one line (T-NOT-FTIN-STACK, Interpretation I-458).
 * A FRACTION (`\S1/2;`, `\S1#2;`) is a number, and the one code that carries one: it reads `1/2`. A
 * TOLERANCE or raised stack (`\S+1^-0;`, `\S2^;`) is no fraction and is never read as one: it reads as
 * its parts, a space between them — `+1 -0`, and `2` where it raises one figure (`kN/m\S2^;` is
 * `kN/m2`, as the sheet shows it). Either stands a space apart from a figure the reading before it
 * ends in — `3'-6\S1/2;"` is `3'-6 1/2"`, six and a half inches, never sixty-one over two and never
 * six; `150\S+5^-0;` is `150 +5 -0`, never 150 5 — and joins anything else as drawn.
 */
function stackSaid(before: string, upper: string, divider: string, lower: string): string {
  const parts = [upper.trim(), lower.trim()];
  const said = divider === TOLERANCE_STACK ? parts.filter((part) => part !== "").join(" ") : parts.join("/");
  return said !== "" && ENDS_IN_A_FIGURE.test(before) ? ` ${said}` : said;
}

/** What one inline code says, given the reading before it: its captures, as `MTEXT_CODE` names them. */
function codeSaid(code: RegExpExecArray | RegExpMatchArray, before: string): string {
  const [whole, escaped, upper, divider, lower, lineBreak, hardSpace, hex] = code;
  if (escaped !== undefined) return escaped;
  if (divider !== undefined) return stackSaid(before, upper ?? "", divider, lower ?? "");
  if (lineBreak !== undefined) return "\n";
  if (hardSpace !== undefined) return " ";
  if (hex !== undefined) return codePointSaid(whole, hex);
  return "";
}

/**
 * A text with its MTEXT inline codes resolved (L-CAD-02, L-CAD-03, T-MTEXT-CODES, T-NOT-FTIN-STACK):
 * every code that says how the text is DRAWN — font, height, width, tracking, slant, colour,
 * alignment, paragraph settings, the underline, overline and strike toggles, the braces a formatted
 * run is grouped in — taken away, and every word and figure it SAYS kept. A stack reads as
 * `stackSaid` says; a paragraph, column or dimension break stands as a line break (`\n`); the
 * non-breaking space as a space; an escaped backslash or brace as itself; a code point as the
 * character it names. The codes are read left to right in one pass, and what each says is never
 * read again.
 *
 * The one home of what an MTEXT code IS (B-17, Interpretation I-458): the notation below, the
 * lines of a block, and what a drawing SHOWS all read through it. The `%%` control codes are NOT
 * resolved here — that is `resolveControlCodes`'s — so a reader that cuts a block into its lines and
 * keeps each line verbatim (the schedule reader) keeps them verbatim.
 */
export function withoutMtextCodes(text: string): string {
  if (!text.includes(INLINE_CODE)) return text;
  let said = "";
  let from = 0;
  for (const code of text.matchAll(MTEXT_CODE)) {
    said += text.slice(from, code.index);
    said += codeSaid(code, said);
    from = code.index + code[0].length;
  }
  return said + text.slice(from);
}

/**
 * One text as the notation reads it: the MTEXT inline codes resolved (`withoutMtextCodes`), the `%%`
 * control codes resolved (`resolveControlCodes`), and every lookalike of the diameter sign written as
 * the one sign.
 *
 * Every comparison of a drawing's words reads through this — a member mark (`normaliseMark`), a band
 * of floors, a schedule cell, a note — so a label drawn `{\fSwis721 Cn BT|b0|i0|c0|p34;C-1}` is the
 * mark C1, and `\Pfy = 415 MPa` states fy with the paragraph code no longer glued to the word
 * (I-458). A paragraph break stays a line break, which every word reader splits on. A reader
 * wanting the lines cuts THIS text at them (`notationLines`), never strips it a second time.
 */
export function normaliseNotation(text: string): string {
  return resolveControlCodes(withoutMtextCodes(text)).replace(DIAMETER_LOOKALIKES, DIAMETER);
}

/** The line break every code that ends a line reads as, in the one reading above. */
const LINE_BREAK = "\n";

/**
 * The lines one text says, as the notation reads them (`normaliseNotation`), cut at its paragraph,
 * column and dimension breaks — the codes resolved once, and never a second time.
 */
export function notationLines(text: string): string[] {
  return normaliseNotation(text).split(LINE_BREAK);
}

/**
 * The LINES an MTEXT's inline codes draw, in the drawing's own order: the text cut at every paragraph
 * mark, with the codes that say how it is drawn taken away and every word it says kept — a stacked
 * fraction among them (L-CAD-02, L-CAD-03, T-MTEXT-CODES, T-NOT-FTIN-STACK). A text carrying no code
 * is one line, itself — which is what a plain TEXT entity is. A blank paragraph is still a line: it is
 * drawn, as empty space, and a reader that positions the lines beneath it counts it.
 *
 * The schedule reader cuts a block here, through the one stripper above (B-17), as any reading of
 * what a drawing SHOWS must; the note clauses and the level words, which read the notation, cut it at
 * `notationLines`. The `%%` control codes are NOT resolved — that is `resolveControlCodes`'s, and a
 * reader that keeps a cell verbatim keeps them verbatim.
 */
export function mtextLines(text: string): string[] {
  return withoutMtextCodes(text).split(LINE_BREAK);
}
