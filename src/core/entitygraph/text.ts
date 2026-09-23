// What a drawing's text SHOWS (L-CAD-02, L-CAD-08): the words a TEXT or MTEXT entity carries, with
// the codes that say HOW it is drawn taken away and the codes that stand for a glyph resolved to it —
// `%%c` is drawn Ø, `%%d` °, `%%p` ±, `\U+2212` −, `\S1/2;` 1/2.
//
// The artifact keeps every text byte for byte (L-CAD-08), and every reader of MEANING reads the
// notation (`./notation`), which also folds the diameter's lookalikes into one sign. This is the
// reading of APPEARANCE, and it is one reading whoever shows a text — the sheet's painter, the
// viewer's inspector and the schedule views all say a drawing's words through it, so `8-16%%C` is
// never `8-16Ø` on one surface and `8-16%%C` on the next (B-17). The `%%` table itself is the
// notation's (`resolveControlCodes`): what a control code means is stated once.
//
// It keeps what the draughtsman typed: the case, the spacing and every glyph, a φ as a φ. Only the
// codes go, and an MTEXT's paragraphs become the lines they are drawn as.
import { mtextLines, resolveControlCodes } from "./notation";

/** The DXF type whose text is a block of formatted paragraphs rather than one plain line. */
const MTEXT = "MTEXT";

/**
 * How far one line of an MTEXT stands beneath the line before it, in multiples of its own character
 * height: the DXF reference's default "3-on-5" spacing, five thirds of the height. The artifact
 * states no spacing factor (L-CAD-05 carries none), so the default is what was drawn.
 */
export const MTEXT_LINE_PITCH = 5 / 3;

/** A code point spelled as a DXF escape — `\U+2212`, four hex digits — which a TEXT and an MTEXT alike draw as the character. */
const UNICODE_ESCAPE = /\\[Uu]\+([0-9A-Fa-f]{4})/g;

/** A character spelled by its three-digit decimal code — `%%176` — the older control code AutoCAD still draws. */
const DECIMAL_CODE = /%%(\d{3})/g;

/**
 * An MTEXT stack — `\S1/2;` a fraction, `\S1#2;` a diagonal one, `\S2^;` a raised or tolerance pair.
 * It is drawn as its two halves one over the other; on one line it is said as they are read.
 */
const MTEXT_STACK = /\\S([^;]*?)([/#^])([^;]*?);/g;

/** Where a dimension's text above the line ends and its text below begins (`\X`), and a column break (`\N`). */
const MTEXT_BREAKS = /\\[XN]/g;

/** The paragraph mark the breaks above become, so the one reading of an MTEXT's lines cuts them. */
const PARAGRAPH = "\\P";

/**
 * The three characters an MTEXT escapes to say them literally — `\\`, `\{` and `\}` — held as
 * private-use stand-ins while the codes are taken away, so a brace the draughtsman meant is never
 * read as a group, and put back after. A character a `\U+` escape spells is held the same way.
 */
const HELD: Readonly<Record<string, string>> = Object.freeze({ "\\": "\uE000", "{": "\uE001", "}": "\uE002" });
const MTEXT_ESCAPES = /\\([\\{}])/g;
const HELD_BACK = /[\uE000-\uE002]/g;
const RELEASED: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(Object.entries(HELD).map(([said, held]) => [held, said])));

/** The surrogate halves (U+D800 to U+DFFF), which name no character on their own. */
const SURROGATES: readonly [number, number] = [55_296, 57_343];

/** A code point as the character it names, or the escape as written where it names none. */
function codePoint(escape: string, hex: string): string {
  const value = Number.parseInt(hex, 16);
  if (!Number.isInteger(value) || (value >= SURROGATES[0] && value <= SURROGATES[1])) return escape;
  return String.fromCodePoint(value);
}

/**
 * The same, inside an MTEXT: a backslash or a brace it spells is held as its stand-in, so the codes
 * taken away after never read it as a code or a group, and it is put back with the rest. A TEXT has
 * no codes to take away, so it takes the character itself (`codePoint`) and nothing is held.
 */
function heldCodePoint(escape: string, hex: string): string {
  const character = codePoint(escape, hex);
  return HELD[character] ?? character;
}

/** A character spelled `%%nnn`, or the code as written where it names no printable character. */
function decimalCode(code: string, digits: string): string {
  const value = Number(digits);
  return value >= 32 && value <= 255 && value !== 127 ? String.fromCharCode(value) : code;
}

/**
 * Every stack of an MTEXT said on one line: a fraction as `1/2`, set a space apart from a whole
 * number it follows (`3'-6 1/2"`, never `3'-61/2"`); a raised pair as its parts.
 */
function unstack(text: string): string {
  return text.replace(MTEXT_STACK, (_stack: string, top: string, kind: string, bottom: string, at: number, whole: string) => {
    if (kind === "^") return bottom.length === 0 ? top : `${top} ${bottom}`;
    return `${/\d$/.test(whole.slice(0, at)) ? " " : ""}${top}/${bottom}`;
  });
}

/** One line's glyph codes resolved: the `%%` table first (so `%%%` is read before a number), then `%%nnn`. */
function glyphsOf(line: string): string {
  return resolveControlCodes(line).replace(DECIMAL_CODE, decimalCode);
}

/**
 * The LINES a text is drawn as, in the drawing's order. A TEXT is one line; an MTEXT is its
 * paragraphs — the formatting taken away by the one reading of an MTEXT's codes (`mtextLines`), its
 * stacks said on the line, its escapes kept as the characters they spell. A blank paragraph is still
 * a line: it is drawn, as empty space, and a painter setting the lines beneath it counts it.
 */
export function displayLines(text: string, type: string): string[] {
  if (type !== MTEXT) return [glyphsOf(text.replace(UNICODE_ESCAPE, codePoint))];
  const held = text
    .replace(MTEXT_ESCAPES, (_escape, character: string) => HELD[character] ?? character)
    .replace(UNICODE_ESCAPE, heldCodePoint)
    .replace(MTEXT_BREAKS, PARAGRAPH);
  return mtextLines(unstack(held)).map((line) => glyphsOf(line).replace(HELD_BACK, (stand) => RELEASED[stand] ?? stand));
}

/**
 * A text as one string, for a surface that says it rather than paints it: its lines, joined by the
 * line break they are drawn with. A text whose type is not known is read as a plain TEXT — the codes
 * that stand for a glyph resolved, and nothing taken away that a plain line could mean.
 */
export function displayText(text: string, type = "TEXT"): string {
  return displayLines(text, type).join("\n");
}
