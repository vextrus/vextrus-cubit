// R-TO-031's notation as a TABLE: every form a Bangladeshi structural set writes a quantity in,
// stated once as data, with the parser built out of that data rather than beside it (B-17, B-19).
//
// Why a table. The barrel next door (`./index`) grew one regex per question, and each regex learned
// the forms its author had seen. A second draughtsman's habit — `4T16` where the first wrote
// `4-16Ø`, `#5` where he wrote `16Ø`, `%%C` where the font wrote `Ø` — read as NOTHING, and a cell
// that reads as nothing is a member that never reaches a bill (L-QTY-04). So the forms are a roster
// here: TOKENS names every glyph a form is spelled with, FORMS composes the readers from those
// tokens, and GRAMMAR is the row-by-row contract — one row per input, every row a test.
//
// Nothing here reaches a store, a clock or a model; every function is total over strings. What a
// reader cannot read is REFUSED by name, never answered null: `NOTATION_UNREAD` carries the token it
// could not read, because a caller shown the token can act and a caller shown `null` cannot
// (ARCH-03).
import type { RefusalCode } from "@/core/errors";

/** The nine questions a cell of a structural set answers. A closed roster (ARCH-01). */
export type NotationKind =
  | "bar_group"
  | "bar_diameter"
  | "spacing"
  | "mark"
  | "level_range"
  | "grade_fc"
  | "grade_fy"
  | "cover"
  | "dimension_ft_in";

/** The form a reading was read by — the id of the row of FORMS that matched (the coverage contract). */
export type FormId =
  | "F-BAR-GROUP"
  | "F-BAR-DIA"
  | "F-SPACING"
  | "F-MARK"
  | "F-LEVEL-RANGE"
  | "F-LEVEL-LIST"
  | "F-FC"
  | "F-FY"
  | "F-COVER"
  | "F-FTIN";

/** The refusal a text nobody can read answers with. Registered in core's closed taxonomy. */
export const NOTATION_UNREAD = "NOTATION_UNREAD" as const satisfies RefusalCode;

/** What a reader answers: the reading, or the refusal naming the token it stopped on. */
export type NotationReading =
  | { readonly ok: true; readonly kind: NotationKind; readonly form: FormId; readonly parsed: unknown; readonly asWritten: string }
  | { readonly ok: false; readonly code: typeof NOTATION_UNREAD; readonly token: string; readonly asWritten: string };

// ---------------------------------------------------------------------------------------------
// TOKENS — the glyphs and words the forms are spelled with. A habit is added HERE, never in a regex.
// ---------------------------------------------------------------------------------------------

/** The mojibake a CP1252 reading of UTF-8 leaves behind, and the glyph each sequence was. A DXF that
 * travelled through a code page arrives spelled this way; the drawing said the glyph on the right. */
const MOJIBAKE: readonly (readonly [string, string])[] = Object.freeze([
  ["âˆ…", "∅"], // âˆ… — ∅ EMPTY SET, the subcontinent's diameter sign
  ["Ã˜", "Ø"], // Ã˜ — Ø
  ["Â°", "°"], // Â° — °
  ["Â±", "±"], // Â± — ±
] as const);

/** DXF's own control codes (L-CAD-02). `%%%` first: it begins with the two characters of the rest. */
const CONTROL_CODES: readonly (readonly [RegExp, string])[] = Object.freeze([
  [/%%%/g, "%"],
  [/%%[Cc]/g, "Ø"],
  [/%%[Dd]/g, "°"],
  [/%%[Pp]/g, "±"],
  [/%%[UuOoKk]/g, ""],
] as const);

/** Every glyph a draughtsman has typed the diameter sign as, folded to the one sign. */
const DIAMETER_LOOKALIKES = /[φΦϕøØ⌀∅]/g;
const DIAMETER = "Ø";

/** The prime and double-prime a font substitutes for the foot and inch marks. */
const FOOT_LOOKALIKES = /[′’´ʹ]/g;
const INCH_LOOKALIKES = /[″”ʺ]/g;

/**
 * MTEXT's formatting codes (L-CAD-02). They say how the text is DRAWN and nothing about what it
 * means, so they are stripped before anything is read — except the stacked fraction, which is the
 * one code that carries a number: `\S1/2;` is drawn as ½ and means one half.
 */
const MTEXT_CODES: readonly (readonly [RegExp, string])[] = Object.freeze([
  [/\\S([^;]*?)[/^#]([^;]*?);/g, " $1/$2"], // the stacked fraction keeps its number
  [/\{\\[fF][^;]*;/g, ""], // {\fSwis721 Cn BT|b1|i0|c0|p34;
  [/\\[fF][^;]*;/g, ""],
  [/\\[pP][^;]*;/g, ""], // \pxi-…;  paragraph settings
  [/\\[AaCcHhQqTtWw][^;]*;/g, ""], // \A1;  \C1;  \H0.7x;  \Q15;  \T1;  \W0.8;
  [/\\[PX]/g, " "], // \P is a line break — two lines of one cell are one cell's words
  [/\\[LlOoKkNn]/g, ""], // underline, overline, strike toggles
  [/\\~/g, " "],
  [/[{}]/g, ""],
] as const);

/** ASTM A615 bar designations and the nominal diameter each names, in millimetres (L-MEA-01: the
 * mapping is the standard's, not this file's guess — a `#5` is 0.625 in = 15.875 mm nominal). */
const ASTM_BAR_MM: Readonly<Record<string, number>> = Object.freeze({
  "3": 9.5, "4": 12.7, "5": 15.9, "6": 19.1, "7": 22.2, "8": 25.4, "9": 28.7, "10": 32.3, "11": 35.8,
});

/** The British designators a second draughtsman writes a deformed bar with: `T`/`Y` before the size.
 * Both name the SAME steel the drawing's own note grades; neither mints a grade here (L-CAD-08). */
const BRITISH_MARKS: readonly string[] = Object.freeze(["T", "Y"]);

/** What separates a count from the bars it counts. Never nothing: a bare `16Ø` states no count. */
const COUNT_SEPARATORS: readonly string[] = Object.freeze(["-", "X", "×", "NOS", "NO", " "]);

/** How a cell closes a spacing. Four spellings of "centre to centre", and the American "on centre". */
const CENTRES_WORDS: readonly string[] = Object.freeze(["C/C", "C\\C", "CC", "O/C", "OC"]);

/** The roles a bar call names beside its group — straight through, or extra at the section. */
const BAR_ROLES: Readonly<Record<string, string>> = Object.freeze({
  ST: "straight", STR: "straight", STRAIGHT: "straight", TH: "straight",
  EXT: "extra", EXTRA: "extra", ADDL: "extra", ADD: "extra",
  STIRRUP: "stirrup", STIRRUPS: "stirrup", LINK: "stirrup", TIE: "stirrup",
  SPIRAL: "spiral", HELIX: "spiral",
});

/** Where in the section a group sits, as a drawing abbreviates it. */
const BAR_FACES: Readonly<Record<string, string>> = Object.freeze({
  "T&B": "top-and-bottom", TB: "top-and-bottom", "B/W": "both-ways", BW: "both-ways",
  EW: "each-way", "E/W": "each-way", TOP: "top", BOT: "bottom", BTM: "bottom", B: "bottom", T: "top",
});

/** The levels a set names by word, and the spelling each reads as. */
const NAMED_LEVELS: Readonly<Record<string, string>> = Object.freeze({
  GF: "GF", GRD: "GF", GRND: "GF", GROUND: "GF",
  FDN: "FDN", FOUNDATION: "FDN", FOOTING: "FDN",
  BASEMENT: "BSMT", BSMT: "BSMT", MEZZANINE: "MEZZ", MEZZ: "MEZZ", ROOF: "ROOF", RF: "ROOF",
});

/** The words that say "floor" and nothing about WHICH floor. */
const STOREY_WORDS: ReadonlySet<string> = new Set(["FLOOR", "FLOORS", "FLR", "FLRS", "LEVEL", "LEVELS", "LVL", "STOREY", "STORY", "SLAB", "PLAN", "LAYOUT", "BEAM", "COLUMN"]);

/** What a set writes between the two ends of a band, and what it writes between two named floors. */
const RANGE_WORDS = /\s*(?:\bTO\b|\bTHRU\b|\bTHROUGH\b|[-–—~])\s*/;
const LIST_WORDS = /\s*(?:&|\bAND\b|\+|,)\s*/;

/** The ladder a range is counted along: the ordinal storeys, with the ground at their foot. */
const ORDINAL = /^(\d+)(?:ST|ND|RD|TH|F)$/;

/** The strengths a note states, and the factor each unit carries to megapascals. */
const STRESS_UNITS: Readonly<Record<string, number>> = Object.freeze({
  PSI: 0.006894757, KSI: 6.894757, MPA: 1, "N/MM2": 1, "N/MM": 1, "KG/CM2": 0.0980665, KSC: 0.0980665,
});

const MM_PER_INCH = 25.4;

// ---------------------------------------------------------------------------------------------
// The one normalisation every reader reads through.
// ---------------------------------------------------------------------------------------------

/** A number the drawing wrote with thousands separators, as a number. */
function numberOf(text: string): number {
  return Number(text.replace(/,/g, ""));
}

/** Float noise is not a reading: every derived millimetre is settled to the micron. */
function settled(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * One text as the grammar reads it: the mojibake repaired, the MTEXT formatting stripped, the DXF
 * control codes resolved, the diameter lookalikes folded, the marks written plainly, upper-cased,
 * and the abbreviating dots dropped — never the point inside a number (`5.0mm` is five, not fifty).
 */
export function plainly(text: string): string {
  let said = text;
  for (const [bytes, glyph] of MOJIBAKE) said = said.split(bytes).join(glyph);
  for (const [code, meaning] of MTEXT_CODES) said = said.replace(code, meaning);
  for (const [code, meaning] of CONTROL_CODES) said = said.replace(code, meaning);
  said = said.replace(DIAMETER_LOOKALIKES, DIAMETER).replace(FOOT_LOOKALIKES, "'").replace(INCH_LOOKALIKES, '"');
  return said.toUpperCase().replace(/(?<!\d)\.|\.(?!\d)/g, "").replace(/\s+/g, " ").trim();
}

/** A roster of words as one alternation, longest first so `NOS` is not read as `NO` (B-19). */
function alternation(words: readonly string[]): string {
  return [...words]
    .sort((left, right) => right.length - left.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join("|");
}

/** Every spelling of a diameter, composed from the token tables — this is the "generated" part. */
const DIA_SOURCE = `(?:Ø\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*(?:MM\\s*)?(?:Ø|DIA)|#\\s*(\\d+)|(${alternation(BRITISH_MARKS)})\\s*(\\d+(?:\\.\\d+)?))`;
const DIA_ANYWHERE = new RegExp(DIA_SOURCE, "g");
const DIA_WHOLE = new RegExp(`^${DIA_SOURCE}$`);

/** One bar as a cell names it: how thick, and the designation the drawing used to say so. */
export type BarDiameter = { readonly diameterMm: number; readonly designation: string };

/** The bar a matched diameter names, or null where the designation is one the standard does not
 * hold — `#12` is not an ASTM size, and inventing a diameter for it would invent steel. */
function barOf(match: RegExpMatchArray): BarDiameter | null {
  const [designation, afterSign, beforeSign, astm, british, britishSize] = [match[0], match[1], match[2], match[3], match[4], match[5]];
  if (astm !== undefined) {
    const held = ASTM_BAR_MM[astm];
    return held === undefined ? null : { diameterMm: held, designation: designation.replace(/\s+/g, "") };
  }
  if (british !== undefined && britishSize !== undefined) return { diameterMm: Number(britishSize), designation: `${british}${britishSize}` };
  const size = afterSign ?? beforeSign;
  return size === undefined ? null : { diameterMm: Number(size), designation: designation.replace(/\s+/g, "") };
}

// ---------------------------------------------------------------------------------------------
// FORMS — one reader per form, each built from the tokens above.
// ---------------------------------------------------------------------------------------------

const FT_IN = /^([+-])?\s*(?:(\d+(?:\.\d+)?)\s*')?\s*(?:-\s*)?(?:(\d+(?:\.\d+)?)?\s*(?:(\d+)\s*\/\s*(\d+))?\s*")?$/;

/** A length in feet and inches, as millimetres — exactly 25.4 to the inch (L-MEA-01). */
function feetInchesMm(said: string): { readonly mm: number; readonly sign: string } | null {
  const match = FT_IN.exec(said.trim());
  if (match === null) return null;
  const [, sign, feet, inches, numerator, denominator] = match;
  if (feet === undefined && inches === undefined && numerator === undefined) return null;
  if (denominator !== undefined && Number(denominator) === 0) return null;
  const fraction = numerator === undefined || denominator === undefined ? 0 : Number(numerator) / Number(denominator);
  const totalInches = Number(feet ?? 0) * 12 + Number(inches ?? 0) + fraction;
  return { mm: settled(totalInches * MM_PER_INCH * (sign === "-" ? -1 : 1)), sign: sign ?? "" };
}

/** A length however the cell stated it — feet and inches, or millimetres outright. */
function lengthMm(said: string): number | null {
  const ftIn = feetInchesMm(said);
  if (ftIn !== null) return ftIn.mm;
  const mm = /^(\d+(?:\.\d+)?)\s*(?:MM)?$/.exec(said.trim());
  return mm === null ? null : Number(mm[1]);
}

const GROUP = new RegExp(`^(\\d+)\\s*(?:(?:${alternation(COUNT_SEPARATORS)})\\s*|(?=[${BRITISH_MARKS.join("")}#Ø]))${DIA_SOURCE}\\s*(.*)$`);
const ROLE_WORD = new RegExp(`\\b(${alternation(Object.keys(BAR_ROLES))})\\b`);
const FACE_WORD = new RegExp(`(?:^|\\s)(${alternation(Object.keys(BAR_FACES))})(?:$|\\s)`);

/** A group of bars: how many, how thick, what role the call gives them and which face they sit on. */
export type BarGroup = {
  readonly n: number;
  readonly diameterMm: number;
  readonly designation: string;
  readonly role: string | null;
  readonly face: string | null;
};

function readBarGroup(said: string): BarGroup | null {
  const match = GROUP.exec(said);
  if (match === null) return null;
  const bar = barOf(["", ...match.slice(2, 7)] as unknown as RegExpMatchArray);
  if (bar === null) return null;
  const designation = match[0].slice(String(match[1]).length).replace(String(match[7] ?? ""), "").trim().replace(/^[-X×\s]|NOS?\s*/gi, "").replace(/\s+/g, "");
  const rest = String(match[7] ?? "").trim();
  const role = ROLE_WORD.exec(rest);
  const face = FACE_WORD.exec(rest);
  if (rest !== "" && role === null && face === null) return null;
  return {
    n: Number(match[1]),
    diameterMm: bar.diameterMm,
    designation: designation === "" ? bar.designation : designation,
    role: role === null ? null : (BAR_ROLES[String(role[1])] ?? null),
    face: face === null ? null : (BAR_FACES[String(face[1])] ?? null),
  };
}

const CENTRES_TAIL = new RegExp(`\\s*(?:${alternation(CENTRES_WORDS)})\\s*$`);

/** A spacing: which bar (where the cell named one), at what centres, and how many legs. */
export type Spacing = {
  readonly bar: BarDiameter | null;
  readonly spacingMm: number;
  readonly legs: number | null;
};

function readSpacing(said: string): Spacing | null {
  const at = said.indexOf("@");
  if (at < 0) return null;
  const tail = said.slice(at + 1).replace(CENTRES_TAIL, "").trim();
  // Only the first length after the "@" is the centres: `@ 75MM C/C (TOP 3.0 M)` states one pitch.
  const centres = lengthMm(tail) ?? lengthMm(tail.split(/[\s(]/)[0] ?? "");
  if (centres === null) return null;
  const head = said.slice(0, at);
  const bars = [...head.matchAll(DIA_ANYWHERE)].map((one) => barOf(one)).filter((one): one is BarDiameter => one !== null);
  const legs = /(\d+)\s*L(?:EG)?S?\b/.exec(head);
  return { bar: bars[bars.length - 1] ?? null, spacingMm: centres, legs: legs === null ? null : Number(legs[1]) };
}

const MARK = /^([A-Z]{1,3})\s*-?\s*(\d+)([A-Z])?$/;

/** A member mark: the class, the number it is, and the variant letter where it carries one. */
export type Mark = { readonly family: string; readonly number: number; readonly variant: string | null };

function readMark(said: string): Mark | null {
  const match = MARK.exec(said.replace(/\s+/g, ""));
  if (match === null) return null;
  return { family: String(match[1]), number: Number(match[2]), variant: match[3] ?? null };
}

/** One end of a band, as the level it names. */
function levelOf(said: string): string | null {
  const word = said.split(/[\s()[\]/,]+/).filter((one) => one !== "" && !STOREY_WORDS.has(one)).join("");
  if (word === "") return null;
  if (ORDINAL.test(word)) return word;
  return NAMED_LEVELS[word] ?? null;
}

/** Where a level stands on the ladder a range is counted along; null for a level the ladder cannot
 * place — the roof's storey is the level stack's to say, not a cell's (L-CAD-07). */
function rungOf(level: string): number | null {
  if (level === "FDN") return -2;
  if (level === "BSMT") return -1;
  if (level === "GF") return 0;
  const ordinal = ORDINAL.exec(level);
  return ordinal === null ? null : Number(ordinal[1]);
}

/** The ordinal's own spelling: 1ST, 2ND, 3RD, 4TH … — the drawing's counting, written back. */
function ordinalSpelling(rung: number): string {
  if (rung === -2) return "FDN";
  if (rung === -1) return "BSMT";
  if (rung === 0) return "GF";
  const tens = rung % 100;
  const suffix = tens >= 11 && tens <= 13 ? "TH" : ["TH", "ST", "ND", "RD"][rung % 10] ?? "TH";
  return `${rung}${suffix}`;
}

/** The levels a header names, in order — a band counted out, or a list written out. */
export type LevelRange = { readonly levels: readonly string[] };

function readLevels(said: string): { readonly parsed: LevelRange; readonly form: FormId } | null {
  const listed = said.split(LIST_WORDS).filter((one) => one.trim() !== "");
  if (listed.length > 1) {
    const levels = listed.map((one) => levelOf(one.trim()));
    if (levels.some((one) => one === null)) return null;
    return { parsed: { levels: levels as string[] }, form: "F-LEVEL-LIST" };
  }
  const ends = said.split(RANGE_WORDS).filter((one) => one.trim() !== "");
  if (ends.length === 1) {
    const only = levelOf(ends[0] ?? "");
    return only === null ? null : { parsed: { levels: [only] }, form: "F-LEVEL-RANGE" };
  }
  if (ends.length !== 2) return null;
  const from = levelOf(ends[0] ?? "");
  const to = levelOf(ends[1] ?? "");
  if (from === null || to === null) return null;
  const low = rungOf(from);
  const high = rungOf(to);
  if (low === null || high === null || high < low) return null;
  const levels: string[] = [];
  for (let rung = low; rung <= high; rung += 1) levels.push(ordinalSpelling(rung));
  return { parsed: { levels }, form: "F-LEVEL-RANGE" };
}

const STRESS = new RegExp(`^(F\\s*'?\\s*C\\s*'?|FY|FS)\\s*[=:]?\\s*([\\d,]+(?:\\.\\d+)?)\\s*(${alternation(Object.keys(STRESS_UNITS))})\\b\\s*(.*)$`);

/** A stated strength: what the note wrote, and the same number in megapascals. */
export type Grade = {
  readonly valueAsWritten: number;
  readonly unitAsWritten: string;
  readonly valueMpa: number;
  readonly standard: string | null;
};

function readGrade(said: string): { readonly parsed: Grade; readonly kind: NotationKind; readonly form: FormId } | null {
  const match = STRESS.exec(said);
  if (match === null) return null;
  const unit = String(match[3]);
  const factor = STRESS_UNITS[unit];
  if (factor === undefined) return null;
  const value = numberOf(String(match[2]));
  const standard = /\b(ASTM|BS|IS|BDS)\s*A?\s*(\d+)\b/.exec(String(match[4] ?? ""));
  const isFc = String(match[1]).replace(/\s/g, "").startsWith("F") && String(match[1]).replace(/\s/g, "").includes("C");
  return {
    kind: isFc ? "grade_fc" : "grade_fy",
    form: isFc ? "F-FC" : "F-FY",
    parsed: {
      valueAsWritten: value,
      unitAsWritten: unit,
      valueMpa: settled(value * factor),
      standard: standard === null ? null : `${String(standard[1])} ${String(standard[2])}`,
    },
  };
}

const COVER = /^(?:CLEAR\s+COVER|COVER)\s*[=:]?\s*(.+)$|^(.+?)\s+(?:CLEAR\s+)?COVER$/;

/** A cover as a note states it, in millimetres whichever unit it was written in. */
export type Cover = { readonly mm: number };

function readCover(said: string): Cover | null {
  const match = COVER.exec(said);
  if (match === null) return null;
  const mm = lengthMm(String(match[1] ?? match[2] ?? "").trim());
  return mm === null ? null : { mm };
}

const LABELLED = /^(?:[A-Z][A-Z\s]{0,11}?)\s*[=:]\s*(.+)$/;

/** A dimension in feet and inches: the millimetres, and the sign a level mark was written with. */
export type Dimension = { readonly mm: number; readonly sign: string };

function readDimension(said: string): Dimension | null {
  const labelled = LABELLED.exec(said);
  return feetInchesMm(labelled === null ? said : String(labelled[1]));
}

/**
 * The readers, in the order a cell is put to them. Order is a rule, not an accident: a spacing is
 * tried before the bar it names (`Ø16@150 C/C` is a spacing, not a bar), a group before the bare
 * diameter (`4T16` counts four; `20Ø` counts none), and the mark LAST — a mark is the shape
 * everything unread would otherwise fall into.
 */
const FORMS: readonly {
  readonly id: FormId;
  readonly kind: NotationKind;
  readonly read: (said: string) => { readonly parsed: unknown; readonly kind?: NotationKind; readonly form?: FormId } | null;
}[] = Object.freeze([
  { id: "F-SPACING", kind: "spacing", read: (said) => { const one = readSpacing(said); return one === null ? null : { parsed: one }; } },
  { id: "F-FC", kind: "grade_fc", read: (said) => readGrade(said) },
  { id: "F-COVER", kind: "cover", read: (said) => { const one = readCover(said); return one === null ? null : { parsed: one }; } },
  { id: "F-FTIN", kind: "dimension_ft_in", read: (said) => { const one = readDimension(said); return one === null ? null : { parsed: one }; } },
  { id: "F-BAR-GROUP", kind: "bar_group", read: (said) => { const one = readBarGroup(said); return one === null ? null : { parsed: one }; } },
  { id: "F-BAR-DIA", kind: "bar_diameter", read: (said) => { const match = DIA_WHOLE.exec(said); if (match === null) return null; const one = barOf(match); return one === null ? null : { parsed: one }; } },
  { id: "F-LEVEL-RANGE", kind: "level_range", read: (said) => readLevels(said) },
  { id: "F-MARK", kind: "mark", read: (said) => { const one = readMark(said); return one === null ? null : { parsed: one }; } },
]);

/** The token a refusal names: the first word the readers could make nothing of, so a person reading
 * the refusal is looking at the drawing's own glyphs and not at a shrug (ARCH-03). */
function offendingToken(said: string, original: string): string {
  const words = said.split(/\s+/).filter((one) => one !== "");
  const unread = words.find((word) => !FORMS.some((form) => form.read(word) !== null));
  return unread ?? (said === "" ? original : said);
}

/**
 * What a cell of a structural drawing says. Total: every string answers, and a string no form reads
 * answers the registered refusal naming the token it stopped on — never null, never a throw.
 */
export function readNotation(text: string): NotationReading {
  const said = plainly(text);
  for (const form of FORMS) {
    const read = form.read(said);
    if (read !== null) return { ok: true, kind: read.kind ?? form.kind, form: read.form ?? form.id, parsed: read.parsed, asWritten: text };
  }
  return { ok: false, code: NOTATION_UNREAD, token: offendingToken(said, text), asWritten: text };
}

/** Every form the parser is built from, for the coverage contract (every form owns a row). */
export const FORM_IDS: readonly FormId[] = Object.freeze(FORMS.map((form) => form.id));

// ---------------------------------------------------------------------------------------------
// GRAMMAR — the table. One row per form a real set writes, and every row is a test.
// ---------------------------------------------------------------------------------------------

/**
 * One row: the string as a drawing writes it, the question it answers, what it reads as, and WHERE
 * the form was seen. `source` is a trap id of F-RCC6-BNBC or a named notation habit — never a
 * project, a name or a piece of a real drawing's text (E-fixture §3.7: the habit travels, the set
 * does not).
 */
export type GrammarRow = {
  readonly input: string;
  readonly kind: NotationKind;
  readonly parsed: unknown;
  readonly source: string;
};

export const GRAMMAR: readonly GrammarRow[] = Object.freeze([
  // — bar groups —————————————————————————————————————————————————————————————————————
  { input: "4T16", kind: "bar_group", parsed: { n: 4, diameterMm: 16, designation: "T16", role: null, face: null }, source: "T-NOT-TY (British T, second draughtsman)" },
  { input: "4Y16", kind: "bar_group", parsed: { n: 4, diameterMm: 16, designation: "Y16", role: null, face: null }, source: "T-NOT-TY (British Y)" },
  { input: "4-Ø16 T&B", kind: "bar_group", parsed: { n: 4, diameterMm: 16, designation: "Ø16", role: null, face: "top-and-bottom" }, source: "T-NOT-UNICODE + face abbreviation" },
  { input: "2-20%%C st.", kind: "bar_group", parsed: { n: 2, diameterMm: 20, designation: "20Ø", role: "straight", face: null }, source: "T-NOT-ST-EXT (straight-through call)" },
  { input: "1-20%%C ext.", kind: "bar_group", parsed: { n: 1, diameterMm: 20, designation: "20Ø", role: "extra", face: null }, source: "T-NOT-ST-EXT (extra bar at the section)" },
  { input: "8-20%%C", kind: "bar_group", parsed: { n: 8, diameterMm: 20, designation: "20Ø", role: null, face: null }, source: "T-NOT-PCTC (%%C decodes to Ø)" },
  { input: "3 NOS 12mmØ", kind: "bar_group", parsed: { n: 3, diameterMm: 12, designation: "12MMØ", role: null, face: null }, source: "schedule habit: NOS separator, mm before the sign" },
  { input: "2x25Ø", kind: "bar_group", parsed: { n: 2, diameterMm: 25, designation: "25Ø", role: null, face: null }, source: "schedule habit: x separator" },
  // — bar diameters ——————————————————————————————————————————————————————————————————
  { input: "#5", kind: "bar_diameter", parsed: { diameterMm: 15.9, designation: "#5" }, source: "T-NOT-HASH (ASTM A615 designation)" },
  { input: "#3", kind: "bar_diameter", parsed: { diameterMm: 9.5, designation: "#3" }, source: "ASTM A615 — the smallest stirrup size" },
  { input: "#11", kind: "bar_diameter", parsed: { diameterMm: 35.8, designation: "#11" }, source: "ASTM A615 — the largest of the plain series" },
  { input: "20%%c", kind: "bar_diameter", parsed: { diameterMm: 20, designation: "20Ø" }, source: "T-NOT-PCTC-LOWER (lower-case control code)" },
  { input: "âˆ…16", kind: "bar_diameter", parsed: { diameterMm: 16, designation: "Ø16" }, source: "T-NOT-MOJIBAKE (CP1252 reading of ∅)" },
  { input: "12Ø", kind: "bar_diameter", parsed: { diameterMm: 12, designation: "12Ø" }, source: "T-NOT-UNICODE" },
  { input: "16 MM DIA.", kind: "bar_diameter", parsed: { diameterMm: 16, designation: "16MMDIA" }, source: "schedule habit: the word DIA instead of the sign" },
  // — spacings ————————————————————————————————————————————————————————————————————————
  { input: "Ø16@150 c/c", kind: "spacing", parsed: { bar: { diameterMm: 16, designation: "Ø16" }, spacingMm: 150, legs: null }, source: "T-NOT-UNICODE (sign first, no space at the @)" },
  { input: "2L-10%%c @ 100 c/c", kind: "spacing", parsed: { bar: { diameterMm: 10, designation: "10Ø" }, spacingMm: 100, legs: 2 }, source: "T-NOT-PCTC-LOWER (two-legged stirrup)" },
  { input: "5.0mm%%C MS Wire @ 75mm c/c", kind: "spacing", parsed: { bar: { diameterMm: 5, designation: "5.0MMØ" }, spacingMm: 75, legs: null }, source: "T-NOT-MSWIRE (spiral pitch; no MS-wire product item)" },
  { input: "#5 @ 6\" c/c B.W.", kind: "spacing", parsed: { bar: { diameterMm: 15.9, designation: "#5" }, spacingMm: 152.4, legs: null }, source: "T-NOT-HASH (imperial centres: 6 in = 152.4 mm)" },
  { input: "10mm âˆ… @ 150 C/C", kind: "spacing", parsed: { bar: { diameterMm: 10, designation: "10MMØ" }, spacingMm: 150, legs: null }, source: "T-NOT-MOJIBAKE with upper-case centres" },
  { input: "Ø12 @ 200 o.c.", kind: "spacing", parsed: { bar: { diameterMm: 12, designation: "Ø12" }, spacingMm: 200, legs: null }, source: "American habit: on centre" },
  // — marks ———————————————————————————————————————————————————————————————————————————
  { input: "C-1", kind: "mark", parsed: { family: "C", number: 1, variant: null }, source: "column mark" },
  { input: "GB-1", kind: "mark", parsed: { family: "GB", number: 1, variant: null }, source: "grade beam mark" },
  { input: "F.B-1", kind: "mark", parsed: { family: "FB", number: 1, variant: null }, source: "census habit: the dotted abbreviation F.B" },
  { input: "B-2A", kind: "mark", parsed: { family: "B", number: 2, variant: "A" }, source: "beam mark with a variant letter" },
  // — level ranges ————————————————————————————————————————————————————————————————————
  { input: "GF TO 3RD", kind: "level_range", parsed: { levels: ["GF", "1ST", "2ND", "3RD"] }, source: "schedule column head: a band counted out" },
  { input: "3RD & 4TH", kind: "level_range", parsed: { levels: ["3RD", "4TH"] }, source: "census habit: a sheet title naming two floors" },
  { input: "1ST-5TH FLOOR", kind: "level_range", parsed: { levels: ["1ST", "2ND", "3RD", "4TH", "5TH"] }, source: "schedule column head with the storey word" },
  { input: "ROOF", kind: "level_range", parsed: { levels: ["ROOF"] }, source: "a head naming one level is a band of that level alone" },
  // — grades ——————————————————————————————————————————————————————————————————————————
  { input: "f'c = 3500 psi", kind: "grade_fc", parsed: { valueAsWritten: 3500, unitAsWritten: "PSI", valueMpa: 24.13165, standard: null }, source: "general note: concrete strength in psi" },
  { input: "fy = 72,500 psi ASTM 615", kind: "grade_fy", parsed: { valueAsWritten: 72500, unitAsWritten: "PSI", valueMpa: 499.869882, standard: "ASTM 615" }, source: "general note: steel grade with its standard and a thousands comma" },
  { input: "fy 415 MPa", kind: "grade_fy", parsed: { valueAsWritten: 415, unitAsWritten: "MPA", valueMpa: 415, standard: null }, source: "the metric half of the same set" },
  // — covers ———————————————————————————————————————————————————————————————————————————
  { input: "2\" clear cover", kind: "cover", parsed: { mm: 50.8 }, source: "general note: imperial cover" },
  { input: "15mm clear cover", kind: "cover", parsed: { mm: 15 }, source: "the metric cover written on the same set" },
  { input: "CLEAR COVER = 40 MM", kind: "cover", parsed: { mm: 40 }, source: "general note: cover stated the other way round" },
  // — dimensions ————————————————————————————————————————————————————————————————————————
  { input: "P.L= +2'-6\"", kind: "dimension_ft_in", parsed: { mm: 762, sign: "+" }, source: "census habit: a plinth level mark in feet and inches" },
  { input: "15'-0\"", kind: "dimension_ft_in", parsed: { mm: 4572, sign: "" }, source: "T-NOT-FTIN (exact ×25.4)" },
  { input: "9'-0\"", kind: "dimension_ft_in", parsed: { mm: 2743.2, sign: "" }, source: "T-NOT-FTIN" },
  { input: "3'-6\\S1/2;\"", kind: "dimension_ft_in", parsed: { mm: 1079.5, sign: "" }, source: "T-NOT-FTIN-STACK (MTEXT stacked fraction)" },
  { input: "{\\fSwis721 Cn BT|b1|i0|c0|p34;\\L12'-0\"}", kind: "dimension_ft_in", parsed: { mm: 3657.6, sign: "" }, source: "census habit: MTEXT format codes around the number" },
] as const);
