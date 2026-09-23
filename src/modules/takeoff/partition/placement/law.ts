// L-CAD-07's placement law: which class a member mark names, and which classes stand on a level
// rather than under one.
//
// "Label normalisation compares dotless-uppercase" — so a mark is read through the notation's own
// `normaliseMark` (B-17: one home) and the class is decided by the letters that mark opens with. The
// map is closed: a mark whose prefix it does not name is a member this stage does not place, which is
// an honest silence rather than a class guessed from a letter (L-QTY-04).
//
// Pure and storeless: the same mark reads the same class forever, which is what lets a stored
// partition be rebuilt onto identical rows (L-REG-04).
import type { ElementType } from "@/core/catalogue/classes";
import { FOUNDATION_CLASSES } from "@/core/catalogue/level-basis";
import type { MemberShape } from "@/core/db";
import type { BandStatement } from "@/core/offers/contract";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import { isMarkFamily, normaliseMark, notationLines, parseDiameter, parseFloorZone, sameStorey } from "../notation";

/** The seven classes a mark names, each written as the member of the catalogue's roster it is. */
const COLUMN = "column" satisfies ElementType;
const SHEAR_WALL = "shear_wall" satisfies ElementType;
const FOOTING = "footing" satisfies ElementType;
const PILE_CAP = "pile_cap" satisfies ElementType;
const PILE = "pile" satisfies ElementType;
const BEAM = "beam" satisfies ElementType;
const TIE_BEAM = "tie_beam" satisfies ElementType;

/**
 * The closed map from the letters a mark opens with to the class it names (increment interfaces).
 * Exact rather than by longest prefix: `SW` is a shear wall and `S` is nothing, `TB` is a tie beam and
 * `T` is nothing, and a lookup that fell back on the first letter would place a stair mark as a shear
 * wall and every tie beam as a beam.
 */
const CLASS_OF_PREFIX: Readonly<Record<string, ElementType>> = Object.freeze({
  C: COLUMN,
  SW: SHEAR_WALL,
  F: FOOTING,
  PC: PILE_CAP,
  P: PILE,
  B: BEAM,
  TB: TIE_BEAM,
  // The beams a floor-by-floor set letters by what they DO rather than as `B` (Interpretation I-341):
  // roof and roof-edge beams, cantilevers, edge beams, a landing beam, porch beams, a transfer girder,
  // and the stair roof's beams — whose own spelling carries a hyphen (`SB-R4`) that the comparison
  // form takes away. Every one is a floor beam in L-MEA-09's sense: it spans between the faces of what
  // carries it and below the slab it carries. The notation grammar's roster already reads each as a
  // mark (`../notation/grammar`'s MARK_FAMILIES); what is added here is the CLASS it names, and only
  // by exact prefix — `L` stays a lintel, `S` a slab, `P` a pile and `PC` a pile cap.
  //
  // `GB` is held back, and on purpose: a grade beam is a tie beam, and a tie beam's run is cut at the
  // faces of the foundation members its OWN plan places — but S-08 draws its 27 caps as unmarked rings,
  // so a grade beam read today would be cut at the column faces a storey above instead and measure
  // two-thirds over (GB1-1: +67 %). It waits for the caps to stand on its plan (L-QTY-06).
  RB: BEAM,
  REB: BEAM,
  CB: BEAM,
  EB: BEAM,
  LB: BEAM,
  PB: BEAM,
  TG: BEAM,
  SBR: BEAM,
});

/** The letters a mark opens with, before the number that tells one member of a family from another. */
const MARK_PREFIX = /^([A-Z]+)\d/;

/**
 * A STOREY-KEYED mark: one digit naming the storey, then a mark of its own (`1B12` is the first
 * floor's beam 12, `1CB3` its cantilever 3, `1EB2` its edge beam 2 — the digit is the level, not part
 * of the class; `../notation/grammar`'s `MARK_NUMBERED` reads the same shape). Only a BEAM is keyed so
 * (I-341): a floor-by-floor set rosters its beams storey by storey and nothing else, and a leading
 * digit before any other class is a count or a code rather than a storey — `8T16` is eight bars.
 */
const STOREY_KEYED_MARK = /^\d([A-Z]+\d+[A-Z]?)$/;

/**
 * L-CAD-07's vertical classes — "vertical classes (column, shear wall) expand per level at
 * placement". A member of one of these repeats over the levels its view's caption states.
 */
export const VERTICAL_CLASSES: readonly ElementType[] = Object.freeze([COLUMN, SHEAR_WALL]);

/**
 * L-CAD-07's foundation classes — "foundation classes take the lawful-null level basis". A footing
 * stands under the building rather than on a storey of it, so it takes the FOUNDATION slot whatever
 * the caption says (L-REG-04). The roster's home is core (`@/core/catalogue/level-basis`), because the
 * manual measurement act must stand a hand footing in the same slot the placement stands a drawn one
 * (s-measure I-377); it is published here for every reader of the placement law (B-17).
 */
export { FOUNDATION_CLASSES };

/**
 * The classes that stand ON a level, and therefore expand over the levels their view states: L-CAD-07's
 * two verticals, and the beam. A beam is not a vertical — it does not run floor-to-floor through the
 * joint — but it is drawn once on a typical plan and stands on every storey that plan is typical of,
 * which is the same expansion (L-MEA-09, L-FRM-02).
 */
export const LEVEL_CLASSES: readonly ElementType[] = Object.freeze([...VERTICAL_CLASSES, BEAM]);

/**
 * The classes a layout plan draws as a PAIR OF EDGE LINES rather than as a closed outline: the members
 * that span between supports (L-MEA-09).
 *
 * A column is drawn as its own footprint, so the outline reader places it. A beam is not: a structural
 * plan draws it as two lines half a width either side of the axis it runs along, and the pair is what
 * anchors it (`./runs`). The two readers are exclusive, because a closed ring standing near a `B` mark
 * is whatever else the plan drew there — a stair well, a hatch boundary — and placing it would be a
 * member nobody drew, carrying no run to measure (L-QTY-04).
 */
export const FRAMED_CLASSES: readonly ElementType[] = Object.freeze([BEAM, TIE_BEAM]);

/**
 * The class this mark names, or null where it names none. Total over any text a drawing carries: a
 * caption, a dimension and a note all name no member and answer null rather than throwing, because a
 * plan's every text is put to this to find out which of them are marks at all.
 */
export function classOfMark(mark: string): ElementType | null {
  const normalised = normaliseMark(mark);
  const keyed = STOREY_KEYED_MARK.exec(normalised)?.[1];
  if (keyed !== undefined) return classOfUnkeyed(keyed) === BEAM ? BEAM : null;
  return classOfUnkeyed(normalised);
}

/** The class a mark written in the comparison form names, read by the letters it opens with. */
function classOfUnkeyed(normalised: string): ElementType | null {
  if (!isMarkFamily(normalised)) return null;
  const prefix = MARK_PREFIX.exec(normalised)?.[1];
  return prefix === undefined ? null : (CLASS_OF_PREFIX[prefix] ?? null);
}

/**
 * The class a BARE PREFIX names — `P`, the whole of a schedule's mark cell with no number after it —
 * or null where the text is not exactly one of the prefixes the map above holds (Interpretation
 * I-321).
 *
 * F-RCC6-BNBC's PILE SCHEDULE writes one row, `P`, and numbers the piles of its layout plan `P1` to
 * `P89`: the number tells one pile from another and the prefix is the TYPE. A mark reader asking
 * `isMarkFamily` refuses `P` (no number), so this is the one reading that says what such a cell
 * names — a class, never a member, and never a guess at which member (L-QTY-01). Exact, like the map:
 * `S` is nothing and `PC` is a pile cap.
 */
export function classOfPrefix(text: string): ElementType | null {
  const normalised = normaliseMark(text);
  return Object.hasOwn(CLASS_OF_PREFIX, normalised) ? (CLASS_OF_PREFIX[normalised] ?? null) : null;
}

/**
 * The class a registered FAMILY names: the class its mark names where the family is a numbered mark,
 * or the class its prefix names where the schedule wrote the bare prefix (I-321). One reading for
 * both, so the registry and the placement ask "what is this family a family of" the same way (B-17).
 */
export function classOfFamily(family: string): ElementType | null {
  return classOfMark(family) ?? classOfPrefix(family);
}

/**
 * L-REG-03: "each quantity kind has exactly one authoritative discipline". Every class this map
 * names is an RCC member — a column, a shear wall, a footing, a pile cap, a pile — and the discipline
 * that measures one is the structural. Read off the sheet law's closed roster rather than spelled
 * beside the sighting it is registered under (Q-07, B-17).
 */
export const PLACEMENT_DISCIPLINE: Discipline = DISCIPLINES[0];

/**
 * The name a CAD program gives a layer it BOUND in from an external reference: the xref's own name, a
 * `$`, the bind's ordinal, a `$`, then the layer as the other drawing called it — `ARCH-PLAN$0$WALL`.
 * The draughtsman typed none of the infix; the program wrote it when the architect's plan was bound
 * into this sheet as background (T-XREF-BOUND).
 */
const BOUND_XREF_LAYER = /^[^$]+\$\d+\$./;

/**
 * Was this entity drawn by ANOTHER drawing, bound into this one as its background (Interpretation
 * I-342)? A bound xref is architectural context — the architect's walls and windows under the
 * structural plan — and no member of this drawing is read off it: F-RCC6-BNBC's S-13 carries the
 * architect's WALL and WINDOW lines as eight congruent pairs 125 apart, and a mark reader that took
 * them as edge lines placed eight 9000- and 1800-long beams under the first floor's `1B` marks, carried
 * at neither end, where no beam was ever drawn (L-QTY-04, L-QTY-06).
 *
 * This reads a layer's NAME for the one thing in it no draughtsman wrote — the program's binding infix
 * — and never for what the name says: `Beam Line`, `Column` and `S-BEAM` stay words this stage does
 * not read (L-CAD-07 reads by content signature). An xref still ATTACHED rather than bound spells its
 * layers `XREF|LAYER`; neither fixture draws one, and this reads none — recorded, not guessed.
 */
export function isBoundXrefContext(layer: string): boolean {
  return BOUND_XREF_LAYER.test(layer);
}

/** Does a member of this class expand over the levels its view states (L-CAD-07)? */
export function isVerticalClass(type: ElementType): boolean {
  return VERTICAL_CLASSES.includes(type);
}

/** Does a member of this class stand in the lawful-null FOUNDATION slot (L-CAD-07, L-REG-04)? */
export function isFoundationClass(type: ElementType): boolean {
  return FOUNDATION_CLASSES.includes(type);
}

/** Does a member of this class expand over the levels its view stands over (L-CAD-07, L-MEA-09)? */
export function isLevelClass(type: ElementType): boolean {
  return LEVEL_CLASSES.includes(type);
}

/** Is a member of this class drawn as a run between its supports rather than as an outline (L-MEA-09)? */
export function isFramedClass(type: ElementType | null): type is ElementType {
  return type !== null && FRAMED_CLASSES.includes(type);
}

/** A word of a caption or a schedule cell: a run of letters and digits. Everything else separates. */
const LEVEL_WORD = /[A-Za-z0-9]+/g;

/**
 * The text a drawing's words are read from, with the codes that only say how it is DRAWN taken away
 * (Interpretation I-410). Two kinds of code go, both read in one pass by their one home (B-17,
 * core's `notationLines`), and never a second time (I-458):
 *   · the MTEXT inline codes: the `{\L…}` underline a caption is drawn with, the `\f…;` font run, the
 *     `\P` paragraph, each line of which is joined to the next by a space;
 *   · the `%%` control codes.
 *
 * Without this, an underlined caption glued its code to its first word. `{\L3RD & 5TH FLOOR …}` read
 * `L3RD`, which names no level, so the caption stated 5TH alone. `{\L1ST FLOOR …}` stated nothing.
 */
function plainWords(said: string): string {
  return notationLines(said).join(" ");
}

/**
 * The level words a piece of the drawing's text says, in the order it says them. Each word is put to
 * the notation's own floor-zone reading (B-17: one home) — `1ST`, `GF`, `ROOF` name levels; `TYPICAL`,
 * `FLOOR`, `PLAN` and `TO` name none — so a caption's levels are read by the same grammar a schedule's
 * `LEVELS` cell is, which is what lets the two be compared at all (L-CAD-07).
 *
 * Here rather than beside either reader because both read it: the expansion asks it of a caption, and
 * the placement asks it of a caption and of a schedule band (B-17). WHICH storeys a caption's level
 * words state between them is `levelRunsOf`'s question, below: two level words are a range only where
 * the drawing wrote one (I-409).
 */
export function levelWordsOf(said: string): string[] {
  return levelSightingsOf(said).flatMap((sighting) => sighting.level ?? []);
}

/**
 * One word of a text as the level reading saw it: the word itself, uppercased the way every other
 * word of the notation is compared, and the level it names or null where it names none.
 *
 * The SIGHTINGS rather than the levels alone, because a note's range is stated by a word that is not
 * a level standing before one that is — `STARTS AT 1F` — and a reader handed only the levels cannot
 * see that `STARTS` was ever written. `levelWordsOf` is this projected onto the levels it saw, so the
 * two readings are one traversal and a word can never read as a level in one and not in the other
 * (B-17). The words are kept in the order the drawing wrote them, which is the only thing that says
 * which level a bounding word bounds.
 */
export type LevelSighting = { readonly word: string; readonly level: string | null };

/** Every word of the text, in order, each with the level it names or null (L-CAD-07). */
export function levelSightingsOf(said: string): LevelSighting[] {
  return sightedIn(plainWords(said)).map(({ word, level }) => ({ word, level }));
}

/** One sighting, with where its word stands in the plain text it was read from. */
type Sighted = LevelSighting & { readonly start: number; readonly end: number };

/** The ONE traversal of a text's words that every level reading here is a projection of (B-17). */
function sightedIn(plain: string): Sighted[] {
  return [...plain.matchAll(LEVEL_WORD)].map((match) => {
    const word = match[0];
    const band = parseFloorZone(word);
    // A single word reads as a band of one level, or as no level at all. A word that read as a band of
    // two would hold a separator, and no run of letters and digits holds one.
    const level = band === null || band.from !== band.to ? null : band.from;
    return { word: word.toUpperCase(), level, start: match.index, end: match.index + word.length };
  });
}

/**
 * One run of storeys a text states. It is a range from one level to another where the drawing wrote
 * one, or one level alone where the drawing listed it. `to` is `TOP_FLOOR` where a range runs to the
 * building's top floor, which only the level stack can place.
 */
export type LevelRun = { readonly from: string; readonly to: string };

/**
 * The word a caption runs a range to the building's top floor with: `1ST TO TOP FLOOR`. It is no level
 * the grammar names, and it is read ONLY as the far end of a range (I-411). Anywhere else a
 * sheet writes `TOP` it means something else: `(TOP LAYER)`, `TOP BARS`, `LIFT TOP`.
 */
export const TOP_FLOOR = "TOP";

/** The storey the top floor stands immediately beneath: the roof, as the grammar spells it (I-411). */
export const TOP_FLOOR_BENEATH = "ROOF";

/**
 * What may stand between a bare `TOP` and the word after it for `TOP` still to END the statement: a
 * closing bracket or a sentence mark. `(1ST TO TOP) COLUMN LAYOUT` ends at the bracket.
 * `1ST FLOOR TO TOP BARS` does not end, so it runs to no floor.
 *
 * A list mark (`,` `&`) does NOT end it. `TOP & BOTTOM` and `TOP, BOTTOM` are how a reinforcement caption
 * names a member's two faces, and reading the list mark as the end of a range turned
 * `1ST FLOOR - TOP & BOTTOM BARS` into 1ST..TOP: five storeys of members nobody drew. The cost runs the
 * safe way. `1ST TO TOP & ROOF` reads 1ST and ROOF, an UNDER on the storeys between, and never an over.
 */
const STATEMENT_CLOSE = /[)\].;:]/;

/**
 * Does the drawing write ONE band from this level word to that end? The question goes to the
 * notation's own band reading, over exactly the text from the one to the other (B-17): the same
 * reading a schedule's `LEVELS` cell gets. The answer is yes where a range sign stands between them
 * (`1ST FLOOR TO 6TH`, `3RD-4TH`, `GF~ROOF`), or where two consecutive storeys are listed, which the
 * grammar reads as the band they are (`3RD & 4TH`). The answer is no for a list that skips a storey
 * (`2ND, 4TH`), and no where other words stand between (`ROOF BEAM LAYOUT (AT ROOF`).
 */
function bandsTo(plain: string, from: Sighted & { readonly level: string }, to: Sighted, toLevel: string): boolean {
  const band = parseFloorZone(plain.slice(from.start, to.end));
  return band !== null && sameStorey(band.from, from.level) && sameStorey(band.to, toLevel);
}

/**
 * Is the range from this level word to `TOP` written in WORDS (`1ST FLOOR TO TOP`, `GF THRU TOP`)
 * rather than with a glyph (`1ST FLOOR - TOP`, `GF~TOP`)? The question goes to the notation's own band
 * reading, so the range signs keep their one home (B-17). The same words are put to it with every glyph
 * between them taken away. A word sign survives that and the band still reads. A dash or a tilde does
 * not survive it, and the band does not read.
 */
function writtenInWords(words: readonly Sighted[], fromLevel: string): boolean {
  const band = parseFloorZone(words.map((sighting) => sighting.word).join(" "));
  return band !== null && sameStorey(band.from, fromLevel) && sameStorey(band.to, TOP_FLOOR);
}

/**
 * Does this level word run a range to the top floor (I-411)? `TOP` must stand where the
 * notation reads a band from this level to it, the far end of a range sign. Then one of two things:
 *   · a storey word follows `TOP` (`1ST-TOP FLOOR`, `3RD FLOOR - TOP FLOOR`). The drawing has said in so
 *     many words that TOP is a floor, and the notation's band reading drops the storey word, so the
 *     band still ends at TOP;
 *   · the range is written in words (`TO`, `THRU`), and the statement ends at `TOP`: nothing follows it,
 *     or a closing mark does.
 *
 * A bare `TOP` after a dash or a tilde is no floor, however the statement ends. On a caption the dash
 * separates the title's parts as often as it runs a range, and a bare `TOP` after one names a face or a
 * layer: `SLAB REINFORCEMENT - 1ST FLOOR - TOP`, `(1ST FLOOR - TOP)`. Reading it as the top floor would
 * stand a single storey's members on every storey above it. The cost is an UNDER: `GF-TOP` reads GF
 * alone, as it did before I-411.
 */
function runsToTop(plain: string, sighted: readonly Sighted[], at: number): boolean {
  const from = sighted[at];
  if (from === undefined || from.level === null) return false;
  const start = { ...from, level: from.level };
  const top = sighted.findIndex((word, index) => index > at && (word.level !== null || word.word === TOP_FLOOR));
  const word = sighted[top];
  if (word === undefined || word.level !== null || !bandsTo(plain, start, word, TOP_FLOOR)) return false;
  const after = sighted[top + 1];
  if (after !== undefined && bandsTo(plain, start, after, TOP_FLOOR)) return true;
  return writtenInWords(sighted.slice(at, top + 1), start.level) && (after === undefined || STATEMENT_CLOSE.test(plain.slice(word.end, after.start)));
}

/**
 * The storeys a text STATES, as runs in the order the drawing wrote them (Interpretation
 * I-409; L-CAD-07). This is the one home of a level SET, beside `levelWordsOf`. It is a set
 * because a sheet captions its floors both ways:
 *   · a range sign runs a range: `TO`, `THRU`, `-`, `~`;
 *   · a list sign lists: `,`, `&`, `AND`;
 *   · a mix states their union: `GF, 2ND TO 4TH & 6TH` is GF, 2ND..4TH and 6TH.
 *
 * Two level words with no range sign between them are two listed storeys and never the storeys
 * between. `2ND, 4TH & 6TH FLOOR BEAM LAYOUT` states three storeys. Reading it first to last would
 * put the plan's members on 3RD and 5TH as well, where no drawing put them: over-measurement, which
 * is a hard block. Read as a list, the worst a miswritten range costs is floors of UNDER.
 *
 * A text naming no level states no run.
 */
export function levelRunsOf(said: string): LevelRun[] {
  const plain = plainWords(said);
  const sighted = sightedIn(plain);
  const levels = sighted.flatMap((word, index) => (word.level === null ? [] : [{ ...word, level: word.level, index }]));
  const runs: LevelRun[] = [];
  // Whether the level word in hand already ENDS the range the one before it ran, and so is stated.
  let ended = false;
  levels.forEach((here, at) => {
    const next = levels[at + 1];
    if (next !== undefined && bandsTo(plain, here, next, next.level)) {
      runs.push({ from: here.level, to: next.level });
      ended = true;
      return;
    }
    if (!ended) runs.push({ from: here.level, to: runsToTop(plain, sighted, here.index) ? TOP_FLOOR : here.level });
    ended = false;
  });
  return runs;
}

/**
 * The shapes a plan note STATES about its member. One member for now — the circle — because that is
 * the one shape a plan writes in words a schedule has no cell for: `C7 Ø450 PORCH COLUMN` is a
 * circular column whose schedule row states `450x450` under every band, and the two are not in
 * disagreement (b = d = 450 either way; a B x D column schedule has no shape column). THE PLAN STATES
 * THE SHAPE, THE SCHEDULE STATES THE SIZE (I-304).
 *
 * THE ROSTER'S ONE HOME IS THE SEAM'S, and this file NAMES its members rather than restating the
 * list. `MemberShape` is `@/core/db`'s, because the store writes its CHECK from the same roster and a
 * second copy here would be two answers to what a plan note may say (B-17). It is the settled shape
 * of this question in this tree: `../grid/law` names two members of the seam's `GRID_FAMILIES` the
 * same way, for the same reason, and says so in as many words. The naming below is what `satisfies`
 * buys — a caller spells a shape by the roster and a member that left the roster stops compiling.
 */
const SHAPE: Readonly<Record<MemberShape, MemberShape>> = Object.freeze({ ROUND: "ROUND" });

/**
 * A plan note about one member: which mark it names, the class that mark is, the range of storeys it
 * states, and the shape it states. Interpretation I-303's whole evidence, read from the text alone.
 */
export type MemberNote = {
  readonly mark: string;
  readonly type: ElementType;
  readonly band: BandStatement | null;
  readonly shape: MemberShape | null;
};

/** What separates the words of a note: whitespace, and nothing else — a mark carries its own dashes. */
const NOTE_WORDS = /\s+/;

/**
 * The words that BOUND a note's range, and the only ones. Exactly one is admitted, because each such
 * word is a licence to narrow a member's span and the cost of admitting one wrongly is measured in
 * whole storeys: this fixture's paper-space revision row `C4 3RD-4TH BARS REVISED; ISSUED FO` and its
 * schedule sheet's `C2 GF TO 2ND:` both name a mark and then name two levels, and a rule that read a
 * range out of any two level words would pin seven C4 placements to 3F-4F — a five-storey
 * under-measurement of the biggest mark family on the sheet (L-QTY-06: no cell may go under by more
 * than 3 %). Neither of those texts says anything about where a member STANDS; both are talking about
 * something else that happens to name floors. `STARTS` is the one word that says where a member
 * begins and nothing else (L-QTY-01: never a guess).
 */
const BOUNDING_WORDS: ReadonlySet<string> = new Set(["STARTS"]);

/**
 * The range of storeys a note STATES, or null where it states none — `C5 FLOATING COLUMN OVER TG1
 * (STARTS AT 1F)` states 1F upwards, and `C7 Ø450 PORCH COLUMN` states nothing and answers null, at
 * which the caller reads I-303's other half: the member stands on the level the plan DRAWS.
 *
 * The statement is read by core's own `bandCovers`, whose meaning is already exactly what `STARTS AT
 * 1F` says: "an open end is no bound: a band stating only its start runs to the top of whatever it is
 * read against" (B-17 — the band has one meaning and this is not a second one).
 *
 * A band with BOTH ends open is unreachable here BY CONSTRUCTION, and that is the point of the shape
 * this returns rather than a convention it observes: `bandOpen` already means "covers everything"
 * (`contract.ts`), which is the precise OPPOSITE of what a note stating no range says, so a note
 * stating no range must answer null and never a band. The only band this can build is built from a
 * level word it actually saw, so `from` is a string every time it answers at all.
 */
export function bandStatedIn(said: string): BandStatement | null {
  const sightings = levelSightingsOf(said);
  const bound = sightings.findIndex((sighting) => sighting.level === null && BOUNDING_WORDS.has(sighting.word));
  if (bound < 0) return null;
  // The level the bounding word bounds is the first one written AFTER it: a note naming a level
  // before it names a beam it sits over, not the storey it starts at.
  const from = sightings.slice(bound + 1).find((sighting) => sighting.level !== null)?.level;
  return from === undefined || from === null ? null : { from, to: null };
}

/**
 * The shape the note's remainder states, read TOKEN BY TOKEN rather than over the sentence whole.
 * A diameter is a word — `Ø450` — and putting a whole note to a diameter reader asks it to find one
 * inside prose, which is how `C1 4-16Ø MAIN` would come back a 16 mm column. One token, one reading
 * (L-QTY-01).
 */
function shapeStatedIn(words: readonly string[]): MemberShape | null {
  return words.some((word) => parseDiameter(word) !== null) ? SHAPE.ROUND : null;
}

/**
 * This text read as a plan note about one member (Interpretation I-303: a plan note is evidence about
 * its member — the member it names is not one of the plan's typical, so it is not expanded by the
 * view's authored typical range; it stands on the level the plan draws, or over the range its own
 * note states), or null where the text is not one.
 *
 * Total over any text a drawing carries, the way `classOfMark` is: a plan's every text is put to this
 * to find out which of them are notes at all.
 *
 * THE TWO READERS PARTITION A PLAN'S TEXTS BY CONSTRUCTION. A text whose whole content is a mark IS a
 * mark and is `markOf`'s (`./detect`); a text this answers for is one `classOfMark` answers null for,
 * because `normaliseMark` strips whitespace (`@/core/identity`'s `dotlessUpper`) and so closes a whole
 * note up into one word that `MARK_FAMILY` refuses — `C7 %%C450 PORCH COLUMN` normalises to
 * `C7Ø450PORCHCOLUMN`, which is why both of this fixture's door strings read as NOTHING today and why
 * placing them is a door rather than a change of reading. The refusal is not left to that accident,
 * though: the guard below asks `classOfMark` of the WHOLE text first, because whitespace is the only
 * thing between `C7 450` and the mark `C7450`, and a text the mark reader takes may never also be
 * read as a note about itself.
 *
 * NO LAYER IS CONSULTED, here or anywhere below. L-CAD-07 reads a drawing by content signature and
 * never by layer names, and the mark reader this partitions against reads no layer either
 * (`./detect`'s `markOf`) — a note is what a text SAYS, not where a draughtsman filed it.
 *
 * A FRAMED class is refused for the same reason the mark reader refuses one: a beam is not placed
 * from an outline standing near its text, so a note about one has no member here to be evidence about
 * (L-MEA-09, `./runs`).
 *
 * AND THE LAST FENCE: THE REMAINDER MUST STATE SOMETHING THIS RULE CAN ACT ON. A note is read here
 * only where its words yield a SHAPE or a BOUNDED RANGE — the two answers I-303 admits and the only
 * two this stage knows what to do with. A mark followed by prose the grammar takes nothing from is a
 * draughtsman's aside, not a statement about where a member stands, and it leaves its member exactly
 * as the plan's typical range found it.
 *
 * That fence is what makes the rule SAFE rather than merely narrow, and it is worth saying why in
 * full, because the unsafe version passes this fixture. Without it, every mark-headed sentence on a
 * plan reads as a note stating no range — and a note stating no range is not inert: I-303's other
 * half puts its member on the level the plan DRAWS and takes every other storey away. So
 * `C4 SEE DETAIL 3/S-12` would pin the C4 family to one storey on the strength of a cross-reference,
 * and this fixture's own `C4 3RD-4TH BARS REVISED; ISSUED FO` and `C2 GF TO 2ND:` would do the same
 * on the strength of two texts that are talking about bars and a schedule band. Each of those three
 * is refused here by its own words rather than by an accident of where it was drawn — which matters,
 * because the two fences that keep this fixture's pair out of the stage at all (a paper-space text is
 * in no view's assignment map, `../views/assign`; a SCHEDULE view yields no instances, `./detect`)
 * are true of THIS drawing and are no guarantee about the next one. A reading that is only safe
 * because of where a text was filed is not a reading (L-QTY-01: never a guess; L-QTY-04: the drawing
 * was silent, so never a silent default).
 *
 * It also makes the singularity guard (`soleNotesAmong`) belt-and-braces rather than load-bearing:
 * S-23's three `SW1 L=…` notes state neither a shape nor a range and are refused right here, before
 * anything has to notice that there are three of them.
 */
export function memberNoteOf(said: string): MemberNote | null {
  const words = said.trim().split(NOTE_WORDS).filter((word) => word !== "");
  const named = words[0];
  // A bare mark carries no further word, and a note is a mark followed by something said about it.
  if (named === undefined || words.length < 2) return null;
  // The whole text read as a mark is a mark, whatever its words look like taken apart.
  if (classOfMark(said) !== null) return null;
  const type = classOfMark(named);
  if (type === null || isFramedClass(type)) return null;
  const rest = words.slice(1);
  const band = bandStatedIn(rest.join(" "));
  const shape = shapeStatedIn(rest);
  // Neither answer stated: this text names a mark and then says something else.
  if (band === null && shape === null) return null;
  return { mark: normaliseMark(named), type, band, shape };
}

/**
 * The notes that are the ONLY note naming their mark, keyed by that mark — the note half of I-303's
 * singularity guard.
 *
 * A note excepts its member from the view's typical range, and an exception may only be taken where
 * there is no doubt which member is excepted. F-RCC6-BNBC's S-23 LIFT CORE PLAN writes TWO notes
 * naming `SW1`, neither of them stating a storey; a blunt rule that let either one except the mark
 * would collapse every shear wall of that core onto the one level the plan draws, which is the
 * over-narrowing I-303 exists to forbid (I-303 only ever NARROWS, and never past what the evidence
 * singles out). Two notes about one mark are two statements, and this stage is in no position to
 * choose between them, so it takes neither and the mark expands as it always did (L-QTY-01).
 *
 * This is HALF the guard, and the half that is a fact about the notes alone. The other half — that
 * the mark names exactly one member — is a fact about the placements the stage holds, and is the
 * stage's to apply beside its own roster.
 */
export function soleNotesAmong(notes: readonly MemberNote[]): Map<string, MemberNote> {
  const byMark = new Map<string, MemberNote[]>();
  for (const note of notes) byMark.set(note.mark, [...(byMark.get(note.mark) ?? []), note]);
  const sole = new Map<string, MemberNote>();
  for (const [mark, named] of byMark) {
    const only = named.length === 1 ? named[0] : undefined;
    if (only !== undefined) sole.set(mark, only);
  }
  return sole;
}
