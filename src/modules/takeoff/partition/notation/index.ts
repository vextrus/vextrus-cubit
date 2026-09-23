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
import type { RebarZone, ScheduleDimension, SectionUnit } from "@/core/db";
import { mtextLines, normaliseNotation, notationLines, withoutMtextCodes } from "@/core/entitygraph/notation";
import { dotlessUpper } from "@/core/identity";
import { useStoreyEquivalence } from "@/core/offers/contract";
import { MM_PER_INCH, readPrintedCount } from "./grammar";

// L-CAD-02's control codes, the MTEXT inline codes and the diameter's many glyphs are core's
// (`@/core/entitygraph/notation`): the note grammar behind TRANSCRIBE_SHEET_NOTES reads a drawing's
// words too and is core, which may not reach a module (ARCH-01). This module re-publishes the one
// reading rather than keeping a second code table (B-17). The parsers below read a text AFTER its
// MTEXT codes are resolved, with its stacked fraction kept (I-458): through `normaliseNotation`,
// or — where the rest of a cell is handed back with its `%%` codes as written — `withoutMtextCodes`.
export { mtextLines, normaliseNotation, notationLines, withoutMtextCodes };

// Which marks are OPENINGS is the grammar table's roster (`./grammar`'s MARK_FAMILIES and MARK_WORDS),
// published through the barrel so the schedules read it by one name (s-schedules I-505, B-17).
export { isOpeningMark } from "./grammar";

/**
 * The four zones a rebar column reads as, each named as the member of the seam's roster it is.
 * Published because a zone is read off a CELL as well as off a header — a stacked schedule states
 * the ties of a band inside the band's own cell — and the name of a zone has one home (B-17).
 */
export const REBAR_ZONE: Readonly<Record<RebarZone, RebarZone>> = Object.freeze({
  main: "main",
  ties: "ties",
  "ties-end": "ties-end",
  "ties-mid": "ties-mid",
});

/** The closed roster itself, as the registry, the store's CHECK and the rails read it. */
export const REBAR_ZONES: readonly RebarZone[] = Object.freeze(Object.values(REBAR_ZONE));

/** The two units a drawing states a section or a spacing in, named the same way. */
const UNIT: Readonly<Record<SectionUnit, SectionUnit>> = Object.freeze({ in: "in", mm: "mm" });

/**
 * The dimensions a schedule states beside a section, named the same way: a record keyed by the
 * seam's own roster, so the store's CHECK, this grammar and the rails spell one list (B-17). The
 * architect's two — an opening's sill and a wall type's thickness — join the foundations' four
 * (s-schedules I-506, I-508).
 */
export const DIMENSION: Readonly<Record<ScheduleDimension, ScheduleDimension>> = Object.freeze({
  depth: "depth",
  dia: "dia",
  length: "length",
  top: "top",
  sill: "sill",
  thickness: "thickness",
});

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

/** The prime and double-prime a font substitutes for the foot and inch marks. */
const FOOT_LOOKALIKES = /[′’´ʹ]/g;
const INCH_LOOKALIKES = /[″”ʺ]/g;

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
 * drawing stated — one side stating it states it for the section — and a pair written with no unit
 * keeps none: a number nobody gave a unit to is not an inch (L-MEA-01).
 *
 * Two sides stating DIFFERENT units state no one section. Taking the first of them would read
 * `12" x 300MM` as 12 × 300 of whichever was written first, and a member sized from that is wrong by
 * a factor of twenty-five. A disagreement is not a size, and nothing here is in a position to decide
 * which side the draughtsman meant.
 */
export function parseSizePair(text: string): SizePair | null {
  const parts = normaliseNotation(text).split(SIZE_SEPARATOR);
  if (parts.length !== 2) return null;
  const width = sideOf(parts[0] ?? "");
  const depth = sideOf(parts[1] ?? "");
  if (width === null || depth === null) return null;
  if (width.unit !== null && depth.unit !== null && width.unit !== depth.unit) return null;
  const unit = width.unit ?? depth.unit;
  return { width: width.value, depth: depth.value, unit };
}

/** A round section as a drawing writes one: the diameter across it, in the unit it stated or in none. */
export type Diameter = { readonly diameter: number; readonly unit: SectionUnit | null };

/**
 * The sign standing BEFORE the figure — `Ø450`, which is the `%%C450` a DXF carries once L-CAD-02's
 * control code is resolved — and the sign or the word standing AFTER it — `450Ø`, `450 MM DIA`. One
 * statement, written with the draughtsman's hand the other way round; a drawing that says a circle
 * of four hundred and fifty says it either way, and a reader that held only one spelling would read
 * half the sheets.
 */
const DIAMETER_BEFORE = /^\s*Ø\s*/;
const DIAMETER_AFTER = /\s*(?:Ø|DIA\.?)\s*$/i;

/**
 * The diameter a round member is written with, or null where the text writes no diameter at all.
 * The unit is the one the drawing stated, taken exactly as a SIDE of a pair takes one (`sideOf`): a
 * `450` beside the sign is a figure nobody gave a unit to and keeps none, while `18" DIA` carries
 * the inch the draughtsman wrote (L-MEA-01). One shape, one reading, wherever it stands.
 *
 * This answers the FIGURE and nothing else. The area of a circle is π/4 d², and computing it here
 * would put a quantity in the grammar: a parser says what the drawing said, and what that figure
 * then measures is the method's question (B-17, R-TO-031 — nothing here reaches a model).
 *
 * It is a RECOGNISER and not a scanner: the sign must stand at one END of the text, so the whole
 * note `C7 Ø450 PORCH COLUMN` answers null even though a diameter is written inside it. The note
 * reader puts this function to a note's tokens ONE AT A TIME; a version that scanned a sentence
 * would read a diameter out of prose — `89 NOS. Ø500 BORED PILES, TOE AT EL -23.165` would become a
 * 500 section for whatever member the sentence happened to name (L-QTY-01: never a guess).
 *
 * `16Ø` reads AS a diameter of sixteen, and that is not a mistake about a bar: the string does say
 * a circle of sixteen, and what makes it a bar rather than a section is the column it stands under,
 * not the glyph. The caller asking the question knows which column it is holding; the grammar does
 * not, and inventing a threshold here ("under 32 is a bar") would be this file deciding a thing no
 * drawing stated.
 */
export function parseDiameter(text: string): Diameter | null {
  const said = normaliseNotation(text);
  for (const sign of [DIAMETER_BEFORE, DIAMETER_AFTER]) {
    if (!sign.test(said)) continue;
    const side = sideOf(said.replace(sign, ""));
    if (side !== null) return { diameter: side.value, unit: side.unit };
  }
  return null;
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

/**
 * The words a column head names a dimension by. `TOP` is not one of them: a beam schedule heads its
 * top BARS `TOP`, and a head that reads as a level on one sheet and as steel on the next names
 * neither until a drawing says which (L-QTY-01: never a guess).
 */
const DIMENSION_WORDS: readonly (readonly [string, ScheduleDimension])[] = Object.freeze([
  ["DIA", DIMENSION.dia],
  ["DIAMETER", DIMENSION.dia],
  ["LENGTH", DIMENSION.length],
  ["DEPTH", DIMENSION.depth],
  // An architect's schedules (s-schedules I-506, I-508): the sill an opening stands on and
  // the thickness a wall type is built to, the second in the abbreviation a Dhaka set writes it in.
  ["SILL", DIMENSION.sill],
  ["THICKNESS", DIMENSION.thickness],
  ["THK", DIMENSION.thickness],
] as const);

/**
 * The words a sill's head may carry beside SILL and still name the sill: its height above the floor,
 * written three ways (`SILL HT.`, `SILL HEIGHT`, `SILL LEVEL`). Beside any other word they are no
 * dimension of their own — a `HEIGHT` column of an opening schedule is read by the size pair, never
 * here.
 */
const SILL_QUALIFIERS: ReadonlySet<string> = new Set(["HT", "HEIGHT", "LEVEL", "LVL"]);

/**
 * The dimension a column head names — `DIA (mm)`, `LENGTH (mm)`, `SILL HT.`, `THICKNESS` — or null
 * where it names none (R-TO-032, AM-06 §2: "pile length comes from the pile schedule").
 *
 * The head is read WHOLE: once the unit it states is set aside, exactly one word must remain and it
 * must be one of the words above. A bar-bending schedule's `CUT LENGTH` is the length of a BAR, and
 * a head that names a member's length and something else besides is a head this grammar cannot say
 * which of the two it measures — so both answer null, and nothing is read under them. The one
 * exception is the sill's own qualifier, which says what a sill IS rather than naming anything else.
 */
export function dimensionOfHeader(header: string): ScheduleDimension | null {
  const stated = wordsOf(spelled(header)).filter((word) => !HEADER_UNITS.some((unit) => unit[0] === word));
  const words = stated.includes("SILL") ? stated.filter((word) => !SILL_QUALIFIERS.has(word)) : stated;
  const only = words.length === 1 ? words[0] : undefined;
  return DIMENSION_WORDS.find((candidate) => candidate[0] === only)?.[1] ?? null;
}

/**
 * A figure a cell states once and then RESTATES in brackets in the other unit — a wall type's
 * `250 (0'-10")`, the way a Dhaka architect writes a thickness in the metric the mason orders and the
 * feet-and-inches the drawing is lettered in (s-schedules I-508). Null where the cell is not that
 * shape, or where the restatement settles no unit.
 *
 * The figure before the bracket GOVERNS — it is the statement, and the bracket its conversion rounded
 * to the draughtsman's precision, so reading the restatement would put a rounded 10" (254 mm) where
 * the drawing states 250. What the bracket DOES settle is the unit of a bare figure: of the units a
 * schedule is written in, the one in which that figure rounds to the restatement (to its whole inch,
 * or its whole millimetre). 250 mm is 9.84" and rounds to 10"; 250" does not — so `250` is 250 mm.
 * Two units that both fit, or none, settle nothing, and the figure keeps no unit (L-MEA-01: a
 * number nobody gave a unit to is not an inch). A figure that states its own unit keeps it.
 */
export function parseRestatedFigure(text: string): { readonly value: number; readonly unit: SectionUnit | null } | null {
  const said = RESTATED.exec(normaliseNotation(text));
  if (said === null) return null;
  const figure = sideOf(said[1] ?? "");
  const restated = sideOf(said[2] ?? "");
  if (figure === null || restated === null) return null;
  if (figure.unit !== null) return figure;
  const to = restated.unit;
  if (to === null) return null;
  const fits = SECTION_UNIT_ROSTER.filter((unit) => Math.round(inUnit(figure.value, unit, to)) === restated.value);
  return fits.length === 1 ? { value: figure.value, unit: fits[0] as SectionUnit } : null;
}

/** A figure, then the same figure again in brackets: `250 (0'-10")`, `125 (5")`. */
const RESTATED = /^\s*([^()]+?)\s*\(\s*([^()]+?)\s*\)\s*$/;

/** The units a figure may be restated between — the seam's two, named through the record above. */
const SECTION_UNIT_ROSTER: readonly SectionUnit[] = Object.freeze(Object.values(UNIT));

/** A figure in one unit, said in another. */
function inUnit(value: number, from: SectionUnit, to: SectionUnit): number {
  if (from === to) return value;
  return from === UNIT.mm ? value / MM_PER_INCH : value * MM_PER_INCH;
}

/**
 * One figure a cell states — `500`, `21336`, `4'-3"`, `1295 MM` — in the unit the cell wrote, or in
 * none: a bare number is a number until its column head or the drawing's declaration says what it
 * measures (L-MEA-01). The same reading a SIDE of a section is read by, so a figure is read one way
 * wherever it stands (B-17).
 */
export function parseFigure(text: string): { readonly value: number; readonly unit: SectionUnit | null } | null {
  return sideOf(text);
}

/** The one head word a schedule states the plans' number of its member under. */
const PLACED_NUMBER_WORD = "NOS";

/**
 * Does this head stand over a column stating how many of the row's member the plans hold — `NOS`?
 * Read WHOLE, like a dimension's head: `NOS PER LEVEL` states something else again, and a `NO.`
 * alone heads a serial number as often as a count.
 *
 * What such a column states is CORROBORATION and never a count: how many members stand is read off
 * the layout plans (R-TO-031, T-SCHED-NORULES), and the registry keeps this figure only to check the
 * plans against it — it is stored nowhere and bills nothing.
 */
export function isPlacedNumberHeader(header: string): boolean {
  const words = wordsOf(spelled(header));
  return words.length === 1 && words[0] === PLACED_NUMBER_WORD;
}

/** A cell stating a whole number and nothing else. */
const WHOLE_NUMBER = /^\s*(\d+)\s*$/;

/** The whole number a cell states, or null where it states anything else. */
export function parseWholeNumber(text: string): number | null {
  const match = WHOLE_NUMBER.exec(normaliseNotation(text));
  return match === null ? null : Number(match[1]);
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
 * The several things one cell says, in the order it says them. A schedule that stacks a mark's whole
 * band inside one cell — the section over the bars over the ties — reaches the registry as one text
 * joined by the sign above, and each reader takes the part of it that answers its own question
 * (L-CAD-08: "two texts in one cell join with `+`"). A cell that says one thing is one part.
 */
export function cellParts(text: string): string[] {
  return text.split(CELL_JOIN).map((part) => part.trim()).filter((part) => part !== "");
}

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

/**
 * What a cell writes between the centres of the end zones and the centres of the middle — and never
 * the bar of a mixed number's fraction: `4 1/2"/6"`, a stacked half inch once its MTEXT code is read
 * (I-458), is four and a half inches at the ends and six in the middle, never `4 1` and `2"` and
 * `6"`. A slash after a whole number and a space and a figure is that fraction's bar.
 */
const ZONE_SEPARATOR = /(?<!\d\s+\d+)\//;

/** The zone a cell names ITSELF with, written after the centres — `(TIES)`, `(LINKS)`. It is the
 * column's own word standing inside the cell, never a third figure. */
const NAMED_TAIL = /\s*\([^)]*\)\s*$/;

/** The centres one zone of a cell states: which zone, which bar, at what spacing, in which unit. */
export type ZonedSpacing = { readonly zone: RebarZone; readonly bar: number | null; readonly spacing: number; readonly unit: SectionUnit | null };

/**
 * The TWO spacings a ties cell states in one breath — `10Ø@100/150 (TIES)`, the way a Bangladeshi
 * column schedule writes a column's links — as the zones they are: the first is the end zones' and
 * the second the middle's (L-FRM-05, where the two are detailed and counted separately). Null where
 * the cell states one spacing or none, which is `parseSpacing`'s question and not this one's.
 *
 * Folding the two into one `ties` would keep one of the two answers and bill the whole column at it;
 * the store holds a row per zone for exactly that reason (AC-4).
 */
export function parseZonedSpacing(text: string): ZonedSpacing[] | null {
  const said = spelled(text);
  const at = said.indexOf(AT_CENTRES);
  if (at < 0) return null;
  const stated = said.slice(at + AT_CENTRES.length).replace(NAMED_TAIL, "").replace(CENTRES, "");
  const parts = stated.split(ZONE_SEPARATOR);
  if (parts.length !== 2) return null;
  const end = sideOf(parts[0] ?? "");
  const mid = sideOf(parts[1] ?? "");
  if (end === null || mid === null) return null;
  const bars = [...said.slice(0, at).matchAll(BAR_DIAMETER)];
  const stamped = bars[bars.length - 1]?.[1];
  const bar = stamped === undefined ? null : Number(stamped);
  return [
    { zone: REBAR_ZONE["ties-end"], bar, spacing: end.value, unit: end.unit },
    { zone: REBAR_ZONE["ties-mid"], bar, spacing: mid.value, unit: mid.unit },
  ];
}

/** What a schedule writes between the two ends of a band of floors. */
const BAND_SEPARATOR = /\s*(?:\bTO\b|\bTHRU\b|\bTHROUGH\b|[-–—~])\s*/;

/** What it writes between two floors it LISTS instead of running a band between (`3RD & 4TH`). */
const BAND_LIST = /\s*(?:&|\bAND\b|\+|,)\s*/;

/**
 * The words that say "this is a floor" and nothing about WHICH floor, so a level reads without them.
 *
 * `EL` is one of them: a building section marks its storeys `GF EL +0.000` … `ROOF EL +21.641`
 * (F-RCC6-BNBC S-25), where the word says only that the number beside it is an elevation. Kept, it
 * joined `GF EL` into `GFEL`, which names no level, and the section proposed no stack at all.
 * `ELEV`, `ELEVATION` and `RL` are NOT here: no drawing either fixture holds writes them, and a word
 * admitted on a hunch is a reading nobody proved (L-QTY-01).
 */
const STOREY_WORDS: ReadonlySet<string> = new Set(["EL", "FLOOR", "FLOORS", "FLR", "FLRS", "LEVEL", "LEVELS", "LVL", "STOREY", "STORY"]);

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

/**
 * A level named by its ordinal — the floors above the ground are counted, never named. Two spellings
 * say the same thing and a drawing uses whichever its draughtsman writes: the English ordinal (`1ST`,
 * `5TH`) and the storey abbreviation the subcontinent's schedules are written in (`1F`, `5F`), which
 * is the same counting with the storey word closed up rather than spelled (L-MEA-01: the drawing's
 * own words). Each reads back as itself — a stack labelled `5F` and a schedule saying `5F` name one
 * level, and neither spelling is rewritten into the other.
 */
const ORDINAL_LEVEL = /^\d+(?:ST|ND|RD|TH|F)$/;

/** That same counting, with the number kept — the one question a LIST of two levels can answer. */
const ORDINAL_COUNT = /^(\d+)(?:ST|ND|RD|TH|F)$/;

/** One end of a band, as the level it names, or null where it names no level at all. */
function levelOf(text: string): string | null {
  const said = wordsOf(text).filter((word) => !STOREY_WORDS.has(word)).join("");
  if (said === "") return null;
  if (ORDINAL_LEVEL.test(said)) return said;
  return NAMED_LEVELS[said] ?? null;
}

/**
 * The shape a level's own LABEL takes: one word, of letters and at least one of them — the way a
 * building names a storey the general roster has never heard of. A bare number is a count and a
 * sentence is a note; neither is a level, and reading one as an end of a band would invent a storey.
 */
const LEVEL_LABEL = /^(?=.*[A-Z])[A-Z0-9]{1,6}$/;

/**
 * One end of a band that names no level this reading knows, carried as the drawing's own word —
 * `ROOF-SRR` runs from the roof to the stair-roof room, and SRR is a label the building's own level
 * stack may or may not hold (F-RCC6-BNBC S-11). Where such a label sits on the ladder is the
 * expansion's question and its refusal to answer (L-CAD-07's `LEVEL_RANGE_ENDPOINT_UNMAPPED`), never
 * this reader's to guess; refusing the whole band here would lose the section the column heads along
 * with the end nobody could place (L-QTY-04).
 */
function labelOf(text: string): string | null {
  const said = wordsOf(text).filter((word) => !STOREY_WORDS.has(word)).join("");
  return LEVEL_LABEL.test(said) ? said : null;
}

/**
 * The band a LIST of two floors names — `3RD & 4TH` heads the sections carried over both of them —
 * or null where the list names no band.
 *
 * Only two CONSECUTIVE ordinals read. A list is not a range: `GF & 5TH` names two floors and says
 * nothing at all about the four between them, and reading it as a band would price four storeys the
 * drawing never banded (L-QTY-01). Two ordinals one apart are the one list where the counting itself
 * says nothing stands between them, so the band is the drawing's own statement rather than a guess.
 */
function listedBand(left: string | null, right: string | null): FloorBand | null {
  if (left === null || right === null) return null;
  const low = ORDINAL_COUNT.exec(left);
  const high = ORDINAL_COUNT.exec(right);
  if (low === null || high === null) return null;
  return Number(high[1]) - Number(low[1]) === 1 ? { from: left, to: right } : null;
}

/**
 * The band of floors a column header names, or null where it names something else. A header naming
 * ONE level is a band of that level alone: a schedule column headed `ROOF` states the section that
 * stands at the roof, and rewriting it as a band from nowhere would lose what the drawing said.
 */
export function parseFloorZone(text: string): FloorBand | null {
  const said = spelled(text).trim();
  // A list is read before a range, because a list writes no range sign for a range reading to find.
  const listed = said.split(BAND_LIST);
  if (listed.length === 2) {
    const band = listedBand(levelOf(listed[0] ?? ""), levelOf(listed[1] ?? ""));
    if (band !== null) return band;
  }
  const parts = said.split(BAND_SEPARATOR);
  if (parts.length === 1) {
    const only = levelOf(parts[0] ?? "");
    return only === null ? null : { from: only, to: only };
  }
  if (parts.length !== 2) return null;
  const from = levelOf(parts[0] ?? "");
  const to = levelOf(parts[1] ?? "");
  if (from !== null && to !== null) return { from, to };
  // One end the rosters place and one they do not is still a band the drawing drew a column for.
  if (from === null && to === null) return null;
  if (from === null) {
    const start = labelOf(parts[0] ?? "");
    return start === null ? null : { from: start, to: to as string };
  }
  const end = labelOf(parts[1] ?? "");
  return end === null ? null : { from, to: end };
}

/** A cell that says how many of something else it holds: `2 OF 4-16Ø`, `3 NOS OF 12Ø`, `2x 4-16Ø`. */
const COUNT_OF = /^\s*(\d+)\s*(?:NOS?\.?\s*)?(?:OF|X|×)\s*(\S.*?)\s*$/i;

/**
 * The count a cell states and the rest of it verbatim, or null where the cell states no count. The
 * rest is handed back UNREAD: what it says is a question for whichever parser the column calls for.
 * Only the MTEXT codes that say how the cell is DRAWN are resolved first — `\A1;2 OF 4-16%%C` counts
 * two — and the rest keeps its `%%` codes as the drawing wrote them (I-458).
 */
export function parseNOf(text: string): CountOf | null {
  const match = COUNT_OF.exec(withoutMtextCodes(text));
  if (match === null) return null;
  return { n: Number(match[1]), rest: match[2] ?? "" };
}

/**
 * One member mark as the registry compares one (riskNotes (3)): the drawing's glyphs folded, then
 * put to L-CAD-07's dotless-uppercase comparison form. `C-1`, `c1.` and `C 1` are one family, and a
 * registry that read them as three would offer placement three columns where the drawing drew one.
 * The glyphs are folded by core's one reading (`normaliseNotation`), which resolves the MTEXT codes
 * first: a label drawn `{\fSwis721 Cn BT|b0|i0|c0|p34;C-1}` or `\A1;C-1` is the mark C1, where it
 * once closed up into `{\FSWIS721CNBT|B0|I0|C0|P34;C1}` and named no member (I-458).
 *
 * The comparison form itself is core's (`dotlessUpper`) rather than this file's: the placeholder a
 * level retires is matched by the same rule, and a rule spelled twice is two rules (B-17).
 */
export function normaliseMark(text: string): string {
  return dotlessUpper(normaliseNotation(text));
}

/**
 * Are these two spellings ONE storey? A drawing spells a storey more than one way on one sheet set
 * — F-RCC6-BNBC's column schedule bands its sections "GF TO 2ND" and "3RD & 4TH" while its section
 * marks the same storeys "2F" and "3F" — and a placement that compared the spellings letter by
 * letter covered no column with any band. Two levels are one storey where the grammar reads the
 * same level in both (`levelOf`: the named levels and the ordinal spellings), or where both carry
 * an ordinal count and the counts agree (3RD = 3F = 3); a word the grammar cannot read at all is
 * compared in the mark comparison form, so a building's own label ("SRR") meets only itself
 * (L-MEA-07: the ordinal is physical; L-QTY-01: never a guess).
 */
export function sameStorey(label: string, other: string): boolean {
  const left = levelOf(label);
  const right = levelOf(other);
  if (left !== null && right !== null) {
    if (left === right) return true;
    const leftCount = ORDINAL_COUNT.exec(left);
    const rightCount = ORDINAL_COUNT.exec(right);
    return leftCount !== null && rightCount !== null && Number(leftCount[1]) === Number(rightCount[1]);
  }
  return normaliseMark(label) === normaliseMark(other);
}

// The reading is registered with core's band placement at this module's load, the way the scale
// seam registers its stated-length reader (I-295b): core may not reach this grammar (ARCH-01), and
// every placement over a stack — the rails', the acts', the expansion's — must judge a storey by the
// one reading (B-17).
useStoreyEquivalence(sameStorey);

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
 *
 * An architect's schedule heads that column with what its rows ARE rather than with MARK
 * (s-schedules I-503): the type an opening sub-table lists, the room a finish schedule is keyed
 * by, the symbol a key names. Such a header is read here too — and `isKeyWordHeader` says it was read
 * by that word alone, which the reconstruction needs to tell a column's head from a group's title.
 */
export function isMarkHeader(text: string): boolean {
  return isMemberMarkHeader(text) || keyWordOf(text) !== null;
}

/** The structural reading: a name word outright, or a qualified word beside a member class. */
function isMemberMarkHeader(text: string): boolean {
  const words = wordsOf(spelled(text));
  if (words.some((word) => NAME_WORDS.has(word))) return true;
  return words.some((word) => QUALIFIED_WORDS.has(word)) && words.some((word) => MEMBER_WORDS.has(word));
}

/**
 * The key column's kinds an architect's schedules are written in (s-schedules I-503): the openings
 * a door and window schedule lists, the rooms a finish schedule is keyed by, and the symbols a key
 * names. A closed roster, read by the reconstruction and the registry alike (ARCH-01).
 */
export const KEY_KINDS = ["opening", "room", "symbol"] as const;

/** One of the three. */
export type KeyKind = (typeof KEY_KINDS)[number];

/**
 * The words each kind of key column is headed by. An opening sub-table is headed by the TYPE it lists
 * — `MAIN DOOR`, `FLUSH DOOR`, `WINDOW`, `WINDOW WITH SUNSHADE`, `VENTILATOR`, `LOUVRE`, `GLASS DOOR`,
 * the Edison sets' `FIXED GLASS` — so the words are the kinds of opening, never the qualifiers a type
 * name carries beside them. `OPENING` is not among them: a structural lintel schedule heads a column
 * `OPENING (mm)` and writes `OVER 1000 OPENING` in its rows, and neither names the openings a row lists.
 */
const KEY_WORDS: Readonly<Record<KeyKind, ReadonlySet<string>>> = Object.freeze({
  opening: new Set(["DOOR", "DOORS", "WINDOW", "WINDOWS", "VENTILATOR", "VENTILATORS", "LOUVRE", "LOUVRES", "LOUVER", "LOUVERS", "GLASS"]),
  room: new Set(["ROOM", "ROOMS"]),
  symbol: new Set(["SYMBOL", "SYMBOLS"]),
});

/** Which kind of key column a header names, where it names one by a key word. */
function keyWordOf(text: string): KeyKind | null {
  const words = wordsOf(spelled(text));
  return KEY_KINDS.find((kind) => words.some((word) => KEY_WORDS[kind].has(word))) ?? null;
}

/**
 * Was this header read as the key column's by a KEY WORD alone — `MAIN DOOR`, `ROOM`, `SYMBOL` — and
 * by no name word of the structural reading? Such a word says what the rows are; it heads a COLUMN
 * only where the band beside it states another column, because alone on its line the same word titles
 * a group of sub-tables (`DOOR`, `WINDOW & VENTILATOR`) or the table itself (`ROOM FINISH SCHEDULE`)
 * (s-schedules I-503). `MARK` heads its column wherever it stands, as it always has.
 */
export function isKeyWordHeader(text: string): boolean {
  return !isMemberMarkHeader(text) && keyWordOf(text) !== null;
}

/**
 * The kind of key column a header names, or null where it names none by a key word: `opening` for a
 * door and window schedule's type head, `room` for a finish schedule's, `symbol` for a key's. A header
 * naming its column by MARK as well (`DOOR MARK`) still says what its rows are.
 */
export function keyKindOfHeader(text: string): KeyKind | null {
  return keyWordOf(text);
}

/**
 * The words an opening schedule heads its quantity column with — `QUANTITY`, `QTY`, `NOS` — read
 * whole, as a dimension's head is. `NO` alone is not among them: it heads a serial column as often as
 * a count (s-schedules I-507).
 */
const QUANTITY_WORDS: ReadonlySet<string> = new Set(["QUANTITY", "QTY", "NOS"]);

/** Does this head stand over the column an opening schedule prints its quantities in? */
export function isPrintedQuantityHeader(header: string): boolean {
  const words = wordsOf(spelled(header));
  return words.length === 1 && QUANTITY_WORDS.has(words[0] as string);
}

/**
 * The quantity one cell of that column PRINTS — `08 NOS`, `01 NO`, `8` — or null where it prints
 * anything else. A reading of what the schedule SAYS, never a count of members (L-CAD-08): the
 * zero-padded `08` is eight, and a cell that also says something else is not read at all.
 *
 * Two readings, each with its one home (B-17): the grammar's count form, which needs the word, and a
 * bare whole number, which only a column headed by a quantity word lets stand as a quantity.
 */
export function parsePrintedQuantity(text: string): number | null {
  return readPrintedCount(text)?.n ?? parseWholeNumber(text);
}

/** The word a note says "each" with, before the storey it counts by: `QUANTITY PER FLOOR`. */
const PER_WORD = "PER";

/**
 * Does this text state that a quantity is counted PER FLOOR — `NOTE: QUANTITY PER FLOOR.`,
 * `NOS PER FLR` — the basis an opening schedule covering several floors must state before its
 * quantities can be compared with a plan (s-schedules I-507; L-MEA-02)? The storey words are the
 * grammar's own (`STOREY_WORDS`, B-17).
 */
export function statesPerFloor(text: string): boolean {
  const words = wordsOf(spelled(text));
  return words.some((word, at) => word === PER_WORD && STOREY_WORDS.has(words[at + 1] ?? ""));
}

/**
 * What parts two column names of a header written as ONE text: a run of two spaces or more. A single
 * space joins the words of one name — `BOTTOM MESH` is one column — and the draughtsman who typed a
 * whole header on one line spaced the columns apart to stand over the cells beneath them
 * (T-SCHED-NORULES).
 */
const COLUMN_GAP = /\s{2,}/;

/**
 * The column names a header written as one text states, in the order it writes them — `MARK  SIZE
 * DEPTH  PILES  BOTTOM MESH  TOP MESH` is six — or one name where the text states one. Words only:
 * WHERE each column stands is not in the text at all (the header's words share one insertion), and is
 * read off the rows beneath it by the reader that knows where they stand.
 */
export function columnNamesOf(text: string): string[] {
  return text
    .trim()
    .split(COLUMN_GAP)
    .filter((name) => name !== "");
}

/** The word a bar-bending schedule heads its bars' own marks with, beside `BAR`. */
const BAR_WORD = "BAR";

/**
 * Does this head stand over the column of a BAR's marks — `BAR MARK`? A table with such a column is a
 * bar-bending schedule: every row of it is one bar, and the member it names beside the bar says what
 * the bar is FOR, never what a member IS — so it registers no member type (R-TO-031, B-17: the member
 * type has one statement, the member schedule's).
 */
export function isBarMarkHeader(text: string): boolean {
  const words = wordsOf(spelled(text));
  return words.includes(BAR_WORD) && words.some((word) => NAME_WORDS.has(word));
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
    if (words.some((word) => END_WORDS.has(word))) return REBAR_ZONE["ties-end"];
    if (words.some((word) => MID_WORDS.has(word))) return REBAR_ZONE["ties-mid"];
    return REBAR_ZONE.ties;
  }
  return words.some((word) => MAIN_WORDS.has(word)) ? REBAR_ZONE.main : null;
}
