// The words S-Ask's grammar reads a question by (docs/design/s-ask.md §1.2, I-396, I-400): the
// catalogue's classes and kinds in the words a Dhaka QS uses for them, the note kinds, the units a
// question may name, the level aliases, and each intent's cue words — and, per project, the marks
// and the level labels THIS register and THIS stack hold.
//
// One home (B-17). Every roster below is keyed by the catalogue's own closed rosters and the unit
// lane holds it to them by enumeration (tests/ai/ask/registry.test.ts, B-19): a class, a kind or a
// note kind the catalogue gains and this file does not name fails there, never silently here.
//
// Words are matched as whole words of the normalised question (`./grammar.ts`), never as substrings:
// `C3` is never read inside `PC3`, and `cap` never inside `capacity`.
import { ELEMENT_TYPES, type ElementType } from "@/core/catalogue/classes";
import { KINDS, type Kind } from "@/core/catalogue/kinds";
import { NOTE_KINDS, type NoteKind } from "@/core/notes/law";
import { DISCIPLINES, type Discipline } from "@/core/sheets/law";
import { markOrder } from "@/modules/takeoff/register-ui/order";
import { FOUNDATION_SLOT, type AskIntent, type AskSources } from "./law";

/** A roster of phrases per member of a closed set: each phrase is words separated by one space. */
type Phrases<K extends string> = Readonly<Record<K, readonly string[]>>;

/**
 * The classes in words, singular and plural, with the short forms a QS writes (§1.2). `wall` alone
 * names no class here: a question naming it is read as whichever of the two wall classes the register
 * holds, and as a clarify between them where it holds both (`WALL_WORDS`).
 */
export const CLASS_WORDS: Phrases<ElementType> = Object.freeze({
  column: ["column", "columns", "col", "cols"],
  beam: ["beam", "beams"],
  slab: ["slab", "slabs"],
  footing: ["footing", "footings"],
  pile_cap: ["pile cap", "pile caps", "pilecap", "pilecaps", "cap", "caps", "pc"],
  pile: ["pile", "piles"],
  tie_beam: ["tie beam", "tie beams", "grade beam", "grade beams"],
  shear_wall: ["shear wall", "shear walls"],
  stair: ["stair", "stairs", "staircase", "staircases"],
  lintel: ["lintel", "lintels"],
  brick_wall: ["brick wall", "brick walls"],
  surface: ["surface", "surfaces"],
});

/** `wall` on its own, and the two classes it may mean. */
export const WALL_WORDS: readonly string[] = Object.freeze(["wall", "walls"]);
export const WALL_CLASSES: readonly ElementType[] = Object.freeze(["shear_wall", "brick_wall"]);

/**
 * The kinds in words, with the Dhaka trade words for each (§1.2). `concrete` alone is reinforced
 * concrete; blinding is PCC and is asked by its own words — `lean concrete` is read before `concrete`
 * because the longer phrase is read first.
 */
export const KIND_WORDS: Phrases<Kind> = Object.freeze({
  "rcc.concrete": ["concrete", "rcc", "cast concrete", "cast in situ concrete", "reinforced concrete"],
  "rcc.formwork": ["formwork", "form work", "shuttering", "shutter", "centering", "centring"],
  "piling.bored": ["bored"],
  "piling.boring": ["boring", "bore length", "bored length"],
  "earthwork.excavation": ["excavation", "earthwork", "earth work", "digging", "excavate"],
  "pcc.blinding": ["blinding", "pcc", "cc", "lean concrete", "plain concrete"],
  "masonry.brickwork": ["brickwork", "brick work", "masonry"],
  "finish.plaster": ["plaster", "plastering"],
  "finish.paint": ["paint", "painting"],
  "rcc.rebar": ["rebar", "rod", "rods", "ms rod", "steel", "reinforcement", "reinforcing", "bars", "bar"],
});

/**
 * The note kinds in words (R-TO-034). A phrase naming a kind outright settles it; `strength` or
 * `grade` beside a material settles it too (`concrete strength`, `steel grade`); `strength`, `grade`,
 * `psi` or `MPa` alone leaves the two strengths to the person (a clarify between them).
 */
export const NOTE_KIND_WORDS: Phrases<NoteKind> = Object.freeze({
  FY: ["fy", "f y", "yield", "yield strength", "steel grade", "grade of steel", "rebar grade", "steel strength", "strength of steel", "reinforcement grade"],
  FC: ["f'c", "fc", "f c", "concrete strength", "strength of concrete", "concrete grade", "grade of concrete", "compressive strength", "cylinder strength"],
  LAP: ["lap", "laps", "lap length", "lap lengths", "splice", "splices"],
  HOOK: ["hook", "hooks", "hook length"],
  HOOK_MIN: ["minimum hook", "min hook", "hook minimum", "minimum hook length"],
});

/** The words that make `strength` or `grade` a concrete's or a steel's. */
export const STRENGTH_WORDS: readonly string[] = Object.freeze(["strength", "grade", "psi", "mpa"]);
export const CONCRETE_WORDS: readonly string[] = Object.freeze(["concrete", "rcc", "cylinder", "cube"]);
export const STEEL_WORDS: readonly string[] = Object.freeze(["steel", "rebar", "rod", "rods", "reinforcement", "bar", "bars"]);

/** The disciplines a sheet question may name, in words. */
export const DISCIPLINE_WORDS: Phrases<Discipline> = Object.freeze({
  STRUCTURAL: ["structural", "structure"],
  ARCHITECTURAL: ["architectural", "architecture"],
  MEP: ["mep", "electrical", "plumbing", "mechanical"],
  CIVIL: ["civil"],
  OTHER: [],
});

/**
 * Units a QS names that the register does not measure in (§1.2, §7): read so the Understood row can
 * say the answer is in the register's unit, never converted.
 */
export const UNITS_ASKED: Readonly<Record<string, string>> = Object.freeze({
  cft: "cft",
  "cu ft": "cft",
  cuft: "cft",
  sft: "sft",
  "sq ft": "sft",
  sqft: "sft",
  rft: "rft",
});

/**
 * The dimension a quantity question names, as the register's unit of it (I-494): `length` is
 * metres, `area` square metres, `volume` cubic metres — and a unit asked in feet names the same one.
 * Where a class's lines are of several kinds, only the kinds measured in that unit are what was asked
 * (`pile length` is the boring, never the concrete).
 */
export const DIMENSION_WORDS: Readonly<Record<string, string>> = Object.freeze({
  length: "m",
  lengths: "m",
  area: "m2",
  areas: "m2",
  volume: "m3",
  volumes: "m3",
});
export const ASKED_UNIT_DIMENSIONS: Readonly<Record<string, string>> = Object.freeze({ cft: "m3", sft: "m2", rft: "m" });

/** The ordinal words of the floors a Dhaka drawing counts (I-400: `first` … `twentieth`). */
export const ORDINAL_WORDS: readonly string[] = Object.freeze([
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
  "fifteenth",
  "sixteenth",
  "seventeenth",
  "eighteenth",
  "nineteenth",
  "twentieth",
]);

/** The words a floor is counted in: `storey`, `story` and `floor` are one word (§1.2). */
export const FLOOR_WORDS: readonly string[] = Object.freeze(["floor", "floors", "storey", "storeys", "story", "stories", "flr"]);

/** "level N", "L N", "lvl N": the words I-400 reads as a clarify unless the stack holds `LN` verbatim. */
export const LEVEL_WORDS: readonly string[] = Object.freeze(["level", "levels", "lvl", "l"]);

/**
 * The words that join two subjects of one slot (I-494): a number beside one of them, next to a
 * counted level, is a level of the same count ("floor 5 and 6", "5th and 6th floor"). The range words
 * among them join two levels as a range, which no one reading holds.
 */
export const RANGE_WORDS: readonly string[] = Object.freeze(["to", "through", "thru", "till", "until", "upto"]);
export const JOINING_WORDS: readonly string[] = Object.freeze(["and", "or", ...RANGE_WORDS]);

/** The ground floor's words, the roof's, and the foundation's (I-400). */
export const GROUND_PHRASES: readonly string[] = Object.freeze(["ground floor", "ground level", "ground"]);
export const ROOF_PHRASES: readonly string[] = Object.freeze(["roof level", "roof", "rf"]);
export const FOUNDATION_PHRASES: readonly string[] = Object.freeze(["foundation level", "footing level", "foundation", "foundations"]);

/** The stack labels the foundation, the ground and the roof go by, in the order a stack is searched. */
export const GROUND_LABELS: readonly string[] = Object.freeze(["GF", "G", "GROUND"]);
export const ROOF_LABELS: readonly string[] = Object.freeze(["ROOF", "RF", "R"]);
export const FOUNDATION_LABELS: readonly string[] = Object.freeze(["FDN", "FOUNDATION", "FND", "FTG"]);

/** A question asked "by level" or "by mark" (§1.2's slot words). */
export const BY_LEVEL_PHRASES: readonly string[] = Object.freeze([
  "floor by floor",
  "by floor",
  "per floor",
  "each floor",
  "every floor",
  "floor wise",
  "floorwise",
  "level by level",
  "by level",
  "per level",
  "each level",
  "storey by storey",
  "by storey",
  "per storey",
  "each storey",
]);
export const BY_MARK_PHRASES: readonly string[] = Object.freeze(["by mark", "per mark", "each mark", "mark wise", "by type", "each type", "per type"]);

/** The refusal cues (§1.2): they outrank every answer — a cost is never answered as a quantity. */
export const ESTIMATE_CUES: readonly string[] = Object.freeze([
  "cost",
  "costs",
  "costing",
  "price",
  "prices",
  "priced",
  "unpriced",
  "pricing",
  "rate",
  "rates",
  "taka",
  "tk",
  "৳",
  "lakh",
  "lakhs",
  "crore",
  "crores",
  "budget",
  "estimate",
  "estimated",
  "money",
  "how long",
  "duration",
]);
export const JUDGEMENT_CUES: readonly string[] = Object.freeze([
  "safe",
  "safety",
  "adequate",
  "enough",
  "sufficient",
  "comply",
  "complies",
  "compliant",
  "compliance",
  "code check",
  "should i",
  "should we",
  "recommend",
  "recommended",
]);

/** Each intent's cue words (§1.2). Where cues overlap, `./grammar.ts` holds the precedence. */
export const INTENT_CUES: Readonly<Record<AskIntent, readonly string[]>> = Object.freeze({
  COUNT: ["how many", "number of", "count", "nos", "no of"],
  MARKS: ["each type", "each mark", "by mark", "by type", "what marks", "which marks", "marks", "types of", "what types", "which types", "per mark"],
  QUANTITY: ["how much", "volume", "area", "length", "quantity", "quantities", "measured quantity"],
  MEASURED_SO_FAR: ["total", "totals", "altogether", "overall", "the building", "whole building", "so far", "been measured", "measured so far", "in all"],
  WHY_NOT_MEASURED: ["why", "no quantity", "not measured", "no figure", "blank", "missing", "unmeasured", "isn't measured", "not been measured", "without a figure", "without figure"],
  MEMBER_TYPE: ["size", "sizes", "section", "sections", "dimension", "dimensions", "main bars", "main bar", "ties", "reinforcement of", "bars of", "how big"],
  NOTE: ["notes", "note", "general notes", "specify", "specified", "specifies", "strength", "grade", "f'c", "fy", "lap", "laps", "hook", "hooks", "psi", "mpa"],
  LEVEL_HEIGHT: ["height", "heights", "floor to floor", "storey height", "story height", "floor height", "how tall", "headroom"],
  SHEET_LIST: ["which sheets", "what sheets", "list the sheets", "list sheets", "sheets in", "drawings in the set", "list the drawings", "sheet list", "how many sheets", "the sheets"],
});

/** "what is the {kind}": the QUANTITY cue a kind word completes. */
export const WHAT_IS_PHRASES: readonly string[] = Object.freeze(["what is", "what's", "whats", "what are", "what was"]);

/* ------------------------------------------------------------------------ the project's words */

/** What THIS project holds that a question may name, read off the register's one reader and the stack. */
export type AskVocabulary = {
  /** Every mark the register holds, in the order a QS counts them, with the classes bearing it. */
  readonly marks: ReadonlyMap<string, readonly ElementType[]>;
  /** The live stack's labels, from the ground up. */
  readonly levels: readonly string[];
  /** Whether any object is filed in the foundation slot (a foundation question reads it). */
  readonly foundationSlot: boolean;
  /** Every class the register holds an object of. */
  readonly classes: ReadonlySet<ElementType>;
  /** The kinds each class holds lines of in the campaign, most lines first. */
  readonly kindsOf: ReadonlyMap<ElementType, readonly Kind[]>;
  /** The unit each (class, kind) is measured in, as its lines state it. */
  readonly unitsOf: ReadonlyMap<ElementType, ReadonlyMap<Kind, string>>;
};

/** A class of the catalogue, read off a register row that names one. */
function classOf(name: string): ElementType | null {
  return (ELEMENT_TYPES as readonly string[]).includes(name) ? (name as ElementType) : null;
}

/** A kind of the catalogue, read off a line. */
function kindOf(name: string): Kind | null {
  return (KINDS as readonly string[]).includes(name) ? (name as Kind) : null;
}

/** The vocabulary of one project's register and stack. */
export function vocabularyOf(sources: Pick<AskSources, "objects" | "lines" | "stack">): AskVocabulary {
  const marks = new Map<string, ElementType[]>();
  const classes = new Set<ElementType>();
  let foundationSlot = false;
  for (const object of sources.objects) {
    const klass = classOf(object.class);
    if (object.level === FOUNDATION_SLOT) foundationSlot = true;
    if (klass === null) continue;
    classes.add(klass);
    if (object.mark.length === 0) continue;
    const held = marks.get(object.mark);
    if (held === undefined) marks.set(object.mark, [klass]);
    else if (!held.includes(klass)) held.push(klass);
  }
  const counted = new Map<ElementType, Map<Kind, number>>();
  const unitsOf = new Map<ElementType, Map<Kind, string>>();
  for (const line of sources.lines) {
    const klass = classOf(line.class);
    const kind = kindOf(line.kind);
    if (klass === null || kind === null) continue;
    const held = counted.get(klass) ?? new Map<Kind, number>();
    held.set(kind, (held.get(kind) ?? 0) + 1);
    counted.set(klass, held);
    const units = unitsOf.get(klass) ?? new Map<Kind, string>();
    if (!units.has(kind)) units.set(kind, line.unit);
    unitsOf.set(klass, units);
  }
  const kindsOf = new Map<ElementType, Kind[]>();
  for (const [klass, kinds] of counted) {
    kindsOf.set(
      klass,
      [...kinds.entries()].sort((left, right) => right[1] - left[1] || KINDS.indexOf(left[0]) - KINDS.indexOf(right[0])).map(([kind]) => kind),
    );
  }
  const ordered = new Map([...marks.entries()].sort((left, right) => markOrder(left[0], right[0])));
  return {
    marks: ordered,
    levels: [...sources.stack].sort((left, right) => left.ordinal - right.ordinal).map((level) => level.label),
    foundationSlot,
    classes,
    kindsOf,
    unitsOf,
  };
}

/** Every roster above that is keyed by a catalogue roster, for the enumeration test (B-19). */
export const KEYED_ROSTERS = Object.freeze({
  classes: { roster: ELEMENT_TYPES, words: CLASS_WORDS },
  kinds: { roster: KINDS, words: KIND_WORDS },
  noteKinds: { roster: NOTE_KINDS, words: NOTE_KIND_WORDS },
  disciplines: { roster: DISCIPLINES, words: DISCIPLINE_WORDS },
});
