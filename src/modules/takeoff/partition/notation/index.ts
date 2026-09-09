// R-TO-031's notation, in one module: the strings a structural schedule is written in — a length in
// feet and inches, a section as a pair, a rebar group, a spacing, a band of floors, a count of
// something else, a member mark and a column header — read by pure functions over text.
//
// Total, every one of them. A cell of a drawing is put to ALL of these to find out what it says, so
// a parser handed a string it does not read answers null rather than throwing, and the same string
// reads the same way forever — which is what lets a stored reading be re-derived instead of kept
// (L-REG-04). Nothing here reaches a store, a clock or a model.
//
// This is the one home of the notation (B-17): the placement leaf, the levels proposal and the rails
// read a drawing's own words through this barrel rather than each keeping a reading of their own.
//
// The four rebar zones and the two units are the seam's closed rosters. They are named here through
// a record KEYED BY the roster's own type, so a member the seam does not hold does not compile and a
// member it holds that this file omits does not compile either: the roster keeps its one home in the
// seam, and this module publishes it for the callers that read a zone off a header (ARCH-01).
import type { RebarZone, SectionUnit } from "@/core/db";
import { dotlessUpper } from "@/core/identity";

/** The four zones a rebar column reads as, each named as the member of the seam's roster it is. */
const ZONE: Readonly<Record<RebarZone, RebarZone>> = Object.freeze({
  main: "main",
  ties: "ties",
  "ties-end": "ties-end",
  "ties-mid": "ties-mid",
});

/** The closed roster itself, as the registry, the store's CHECK and the rails read it. */
export const REBAR_ZONES: readonly RebarZone[] = Object.freeze(Object.values(ZONE));

/** The two units a drawing states a section or a spacing in, named the same way. */
const UNIT: Readonly<Record<SectionUnit, SectionUnit>> = Object.freeze({ in: "in", mm: "mm" });

/** A section as a drawing writes one: width by depth, in the unit it stated or in none at all. */
export type SizePair = { readonly width: number; readonly depth: number; readonly unit: SectionUnit | null };

/** One group of bars: how many, and how thick each is. Bar diameters are stated in millimetres. */
export type RebarGroup = { readonly n: number; readonly diameterMm: number };

/** A spacing as a ties cell states one: which bar, at what centres, in which unit. */
export type BarSpacing = { readonly bar: number | null; readonly spacing: number; readonly unit: SectionUnit | null };

/** A band of floors, as a schedule column heads one: the level it runs from and the one it runs to. */
export type FloorBand = { readonly from: string; readonly to: string };

/** A cell that says a count of something else: the count, and the rest of the cell verbatim. */
export type CountOf = { readonly n: number; readonly rest: string };

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
const DIAMETER = "Ø";

/** The prime and double-prime a font substitutes for the foot and inch marks. */
const FOOT_LOOKALIKES = /[′’´ʹ]/g;
const INCH_LOOKALIKES = /[″”ʺ]/g;

/**
 * One text as the notation reads it: the control codes resolved, and every lookalike of the diameter
 * sign written as the one sign. What a text SAYS is kept — the case, the spacing and the marks are
 * the drawing's own, and a cell is stored verbatim beside whatever was parsed out of it (L-CAD-03).
 */
export function normaliseNotation(text: string): string {
  let said = text;
  for (const [code, meaning] of CONTROL_CODES) said = said.replace(code, meaning);
  return said.replace(DIAMETER_LOOKALIKES, DIAMETER);
}

/** The same text with the foot and inch marks written plainly, for the length parsers to read. */
function plainMarks(text: string): string {
  return normaliseNotation(text).replace(FOOT_LOOKALIKES, "'").replace(INCH_LOOKALIKES, '"');
}

/** The dots a word is abbreviated with — `G.F.`, `NO.`, `MAIN REINF.` — and never the point inside a
 * number: a dot between two digits is a decimal, and dropping it would read `4.5"` as `45"` (L-MEA-01). */
const ABBREVIATION_DOT = /(?<!\d)\.|\.(?!\d)/g;

/** That text, uppercased and with its dots dropped — the form every word of the notation compares in. */
function spelled(text: string): string {
  return normaliseNotation(text).toUpperCase().replace(ABBREVIATION_DOT, "");
}

/** The words of a text, in order, with the empties dropped. */
function wordsOf(text: string): string[] {
  return text.split(/[\s()[\]/,]+/).filter((word) => word !== "");
}

/**
 * A length in feet and inches, in total inches, or null where the text states no length at all. A
 * bare number is no length: `12` on a drawing that says nothing about its units is a number, and
 * reading it as inches would be inventing the unit the drawing withheld (L-MEA-01).
 */
const FEET_INCHES = /^\s*(?:(\d+(?:\.\d+)?)\s*')?\s*-?\s*(?:(?:(?:(\d+(?:\.\d+)?)\s+)?(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d+)?))\s*")?\s*$/;

export function parseFeetInches(text: string): number | null {
  const match = FEET_INCHES.exec(plainMarks(text));
  if (match === null) return null;
  const [, feet, mixedWhole, numerator, denominator, whole] = match;
  const inches = numerator === undefined ? whole : mixedWhole;
  if (feet === undefined && inches === undefined && numerator === undefined) return null;
  const fraction = numerator === undefined || denominator === undefined || Number(denominator) === 0 ? 0 : Number(numerator) / Number(denominator);
  return Number(feet ?? 0) * 12 + Number(inches ?? 0) + fraction;
}

/** The signs a drawing writes "by" with, between the two sides of a section. */
const SIZE_SEPARATOR = /[xX×]/;

/** A bare number, with the millimetre a drawing may have written after it. */
const BARE_LENGTH = /^\s*(\d+(?:\.\d+)?)\s*(MM)?\s*$/i;

/** One side of a section: what it measures, and the unit the drawing stated for it, if any. */
function sideOf(text: string): { readonly value: number; readonly unit: SectionUnit | null } | null {
  const stated = parseFeetInches(text);
  if (stated !== null) return { value: stated, unit: UNIT.in };
  const bare = BARE_LENGTH.exec(normaliseNotation(text));
  if (bare === null) return null;
  return { value: Number(bare[1]), unit: bare[2] === undefined ? null : UNIT.mm };
}

/**
 * A section written as a pair, or null where the text is not a pair at all. The unit is the one the
 * drawing stated — either side stating it states it for the section — and a pair written with no
 * unit keeps none: a number nobody gave a unit to is not an inch (L-MEA-01).
 */
export function parseSizePair(text: string): SizePair | null {
  const parts = normaliseNotation(text).split(SIZE_SEPARATOR);
  if (parts.length !== 2) return null;
  const width = sideOf(parts[0] ?? "");
  const depth = sideOf(parts[1] ?? "");
  if (width === null || depth === null) return null;
  const unit = width.unit ?? depth.unit;
  return { width: width.value, depth: depth.value, unit };
}

/** How a schedule heads a column with the unit its cells are written in, per member of the roster. */
const HEADER_UNITS: readonly (readonly [string, SectionUnit])[] = Object.freeze([
  ["MM", UNIT.mm],
  ["IN", UNIT.in],
  ["INCH", UNIT.in],
  ["INCHES", UNIT.in],
] as const);

/**
 * The unit a column header states for the cells beneath it — `SIZE (B X D) MM`, `L X B MM` — or null
 * where it states none.
 *
 * A schedule states its unit ONCE, in the head of the column, and writes bare numbers under it; the
 * head is where the drawing said it, so reading it is reading the drawing rather than inventing the
 * unit it withheld (L-MEA-01: a number nobody gave a unit to is not an inch — but this one was given
 * one). A cell that carries its own unit outranks the head: it is the nearer statement (R-TO-031).
 */
export function sectionUnitOfHeader(header: string): SectionUnit | null {
  for (const word of wordsOf(spelled(header))) {
    const held = HEADER_UNITS.find((candidate) => candidate[0] === word);
    if (held !== undefined) return held[1];
  }
  return null;
}

/** What separates the count of a rebar group from the diameter of its bars. Never nothing: a bare
 * `16Ø` states a diameter and no count, and reading a count out of its digits would be a guess. */
const REBAR_GROUP = /^(\d+)(?:\s*-\s*|\s+(?:NOS?\.?|X)\s+|\s+)(\d+)\s*(?:MM)?\s*(?:Ø|DIA\.?|MM)\s*$/;

/**
 * How a cell separates the groups of bars it names — and, for the same reason, how a reconstructed
 * cell joins the two texts a draughtsman stacked inside it: one cell saying two things says them
 * with a plus, whether the drawing wrote the sign or drew the second text under the first (AC-2).
 */
export const CELL_JOIN = "+";

/**
 * The groups of bars a cell names, in the order it names them, or null where it names none. Every
 * group must read: a cell half of which is a group and half of which is prose is a cell this rule
 * does not read, and half an answer is worse than none (L-QTY-04).
 */
export function parseRebarGroups(text: string): RebarGroup[] | null {
  const parts = spelled(text).split(CELL_JOIN);
  const groups: RebarGroup[] = [];
  for (const part of parts) {
    const match = REBAR_GROUP.exec(part.trim());
    if (match === null) return null;
    groups.push({ n: Number(match[1]), diameterMm: Number(match[2]) });
  }
  return groups.length === 0 ? null : groups;
}

/** The mark a spacing is stated at, and the "c/c" a draughtsman closes the cell with. */
const AT_CENTRES = "@";
const CENTRES = /\s*C\s*[/\\]?\s*C\s*$/;

/** A bar named by its diameter, wherever it stands in the words before the centres. */
const BAR_DIAMETER = /(\d+(?:\.\d+)?)\s*(?:MM\s*)?(?:Ø|DIA|MM)/g;

/**
 * A spacing, or null where the text states none. The "@" is what makes a cell a spacing: a cell that
 * names a bar and no centres is a bar, and one that names centres and no bar is still a spacing —
 * which is why the bar is nullable and the centres are not.
 */
export function parseSpacing(text: string): BarSpacing | null {
  const said = spelled(text);
  const at = said.indexOf(AT_CENTRES);
  if (at < 0) return null;
  const centres = sideOf(said.slice(at + AT_CENTRES.length).replace(CENTRES, ""));
  if (centres === null) return null;
  const bars = [...said.slice(0, at).matchAll(BAR_DIAMETER)];
  const bar = bars[bars.length - 1]?.[1];
  return { bar: bar === undefined ? null : Number(bar), spacing: centres.value, unit: centres.unit };
}

/** What a schedule writes between the two ends of a band of floors. */
const BAND_SEPARATOR = /\s*(?:\bTO\b|\bTHRU\b|\bTHROUGH\b|[-–—~])\s*/;

/** The words that say "this is a floor" and nothing about WHICH floor, so a level reads without them. */
const STOREY_WORDS: ReadonlySet<string> = new Set(["FLOOR", "FLOORS", "FLR", "FLRS", "LEVEL", "LEVELS", "LVL", "STOREY", "STORY"]);

/** The levels a drawing names by word rather than by ordinal, and the spelling each one reads as. */
const NAMED_LEVELS: Readonly<Record<string, string>> = Object.freeze({
  GF: "GF",
  GRD: "GF",
  GRND: "GF",
  GROUND: "GF",
  ROOF: "ROOF",
  RF: "ROOF",
  FDN: "FDN",
  FOUNDATION: "FDN",
  BASEMENT: "BSMT",
  BSMT: "BSMT",
  MEZZANINE: "MEZZ",
  MEZZ: "MEZZ",
});

/** A level named by its ordinal — the floors above the ground are counted, never named. */
const ORDINAL_LEVEL = /^\d+(?:ST|ND|RD|TH)$/;

/** One end of a band, as the level it names, or null where it names no level at all. */
function levelOf(text: string): string | null {
  const said = wordsOf(text).filter((word) => !STOREY_WORDS.has(word)).join("");
  if (said === "") return null;
  if (ORDINAL_LEVEL.test(said)) return said;
  return NAMED_LEVELS[said] ?? null;
}

/**
 * The band of floors a column header names, or null where it names something else. A header naming
 * ONE level is a band of that level alone: a schedule column headed `ROOF` states the section that
 * stands at the roof, and rewriting it as a band from nowhere would lose what the drawing said.
 */
export function parseFloorZone(text: string): FloorBand | null {
  const parts = spelled(text).trim().split(BAND_SEPARATOR);
  if (parts.length === 1) {
    const only = levelOf(parts[0] ?? "");
    return only === null ? null : { from: only, to: only };
  }
  if (parts.length !== 2) return null;
  const from = levelOf(parts[0] ?? "");
  const to = levelOf(parts[1] ?? "");
  return from === null || to === null ? null : { from, to };
}

/** A cell that says how many of something else it holds: `2 OF 4-16Ø`, `3 NOS OF 12Ø`, `2x 4-16Ø`. */
const COUNT_OF = /^\s*(\d+)\s*(?:NOS?\.?\s*)?(?:OF|X|×)\s*(\S.*?)\s*$/i;

/**
 * The count a cell states and the rest of it verbatim, or null where the cell states no count. The
 * rest is handed back UNREAD: what it says is a question for whichever parser the column calls for.
 */
export function parseNOf(text: string): CountOf | null {
  const match = COUNT_OF.exec(text);
  if (match === null) return null;
  return { n: Number(match[1]), rest: match[2] ?? "" };
}

/**
 * One member mark as the registry compares one (riskNotes (3)): the drawing's glyphs folded, then
 * put to L-CAD-07's dotless-uppercase comparison form. `C-1`, `c1.` and `C 1` are one family, and a
 * registry that read them as three would offer placement three columns where the drawing drew one.
 *
 * The comparison form itself is core's (`dotlessUpper`) rather than this file's: the placeholder a
 * level retires is matched by the same rule, and a rule spelled twice is two rules (B-17).
 */
export function normaliseMark(text: string): string {
  return dotlessUpper(normaliseNotation(text));
}

/** A mark names a member: a letter or two of its class, the number it is, and a variant letter. */
const MARK_FAMILY = /^[A-Z]{1,3}\d+[A-Z]?$/;

/**
 * Does this cell name a member? Noise is never a family (AC-5): a note, a dash, a dimension, a bar
 * group and the header word over the column are all things standing in a mark column that name no
 * member, and a registry that minted a family for one of them would offer placement a member that
 * was never drawn (L-QTY-04).
 */
export function isMarkFamily(text: string): boolean {
  return !isMarkHeader(text) && MARK_FAMILY.test(normaliseMark(text));
}

/** The words that name the column of marks outright. */
const NAME_WORDS: ReadonlySet<string> = new Set(["MARK", "MARKS", "MEMBER", "DESIGNATION"]);

/** The words that name it only beside a member class — a bare `NO` heads any column of numbers. */
const QUALIFIED_WORDS: ReadonlySet<string> = new Set(["NO", "TYPE", "ID", "NAME", "REF"]);

/** The classes a schedule is drawn for, as its header spells them. */
const MEMBER_WORDS: ReadonlySet<string> = new Set(["COLUMN", "COLUMNS", "COL", "BEAM", "BEAMS", "BM", "FOOTING", "FOOTINGS", "FTG", "SLAB", "WALL", "PILE", "MEMBER", "SHEAR"]);

/**
 * Does this header stand over the column of marks? The header band of a table is the first leading
 * band holding a cell this reads (AC-1), so this is what anchors the whole reconstruction.
 */
export function isMarkHeader(text: string): boolean {
  const words = wordsOf(spelled(text));
  if (words.some((word) => NAME_WORDS.has(word))) return true;
  return words.some((word) => QUALIFIED_WORDS.has(word)) && words.some((word) => MEMBER_WORDS.has(word));
}

/** The words that head a column of ties, and the two zones a ties column may be narrowed to. */
const TIE_WORDS: ReadonlySet<string> = new Set(["TIE", "TIES", "STIRRUP", "STIRRUPS", "LINK", "LINKS", "LATERAL", "RING", "RINGS"]);
const END_WORDS: ReadonlySet<string> = new Set(["END", "ENDS"]);
const MID_WORDS: ReadonlySet<string> = new Set(["MID", "MIDDLE"]);

/** The words that head a column of the bars running the length of the member. */
const MAIN_WORDS: ReadonlySet<string> = new Set(["MAIN", "LONGITUDINAL", "LONGI", "VERTICAL", "VERT"]);

/**
 * Which of the four zones a column header names, or null where it names no rebar at all. The ties
 * are narrowed before they are answered: a drawing that draws an end zone and a mid zone states two
 * different spacings, and folding them into one `ties` would keep one of the two answers.
 */
export function rebarZoneOfHeader(text: string): RebarZone | null {
  const words = wordsOf(spelled(text));
  if (words.some((word) => TIE_WORDS.has(word))) {
    if (words.some((word) => END_WORDS.has(word))) return ZONE["ties-end"];
    if (words.some((word) => MID_WORDS.has(word))) return ZONE["ties-mid"];
    return ZONE.ties;
  }
  return words.some((word) => MAIN_WORDS.has(word)) ? ZONE.main : null;
}
