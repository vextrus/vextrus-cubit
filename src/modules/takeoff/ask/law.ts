// S-Ask's contract (R-AI-003, X-7, docs/design/s-ask.md §0, §1.2, §6): what a question is read as,
// what the engine reads to answer it, and the FACTS it answers with.
//
// The engine answers facts and never a sentence (I-398). ARCH-01 bars `src/modules` from `src/ui`, so
// the string table (`src/ui/strings/ask.ts`) is the screen's, and the screen composes every statement
// from the facts below; every figure crosses as an exact decimal with its unit, its kind and the places
// the register writes that kind at, and the screen states it through the format seam. A figure is an
// integer count or an exact sum taken in core, never a float and never rounded before it is stated.
//
// Leaf file: types, the closed rosters and nothing that opens a store, so the browser half of S-Ask
// may import it without carrying a database into its bundle.
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { REFUSALS, type RefusalCode } from "@/core/errors";
import type { NoteKind } from "@/core/notes/law";
import type { Discipline } from "@/core/sheets/law";

/**
 * The closed intent roster (§1.2): one query per intent in `./queries/registry.ts`. The two
 * sheet-text intents, "which sheet holds the schedule" and "find on the sheets", join it with the
 * text index they read (ASK-3); until then a question asking either is not understood, by name.
 */
export const ASK_INTENTS = [
  "COUNT",
  "MARKS",
  "QUANTITY",
  "MEASURED_SO_FAR",
  "WHY_NOT_MEASURED",
  "MEMBER_TYPE",
  "NOTE",
  "LEVEL_HEIGHT",
  "SHEET_LIST",
] as const;

/** One intent of the roster. */
export type AskIntent = (typeof ASK_INTENTS)[number];

/** Is this string an intent of the roster? Asked where a reading crosses the wire. */
export function isAskIntent(value: unknown): value is AskIntent {
  return typeof value === "string" && (ASK_INTENTS as readonly string[]).includes(value);
}

/** Who made the reading an answer stands on (`data-routed-by`): the grammar, the machine, the person. */
export const ASK_ROUTED_BY = ["GRAMMAR", "MODEL", "PERSON"] as const;

/** One of the three. */
export type AskRoutedBy = (typeof ASK_ROUTED_BY)[number];

/** How a question asks its figure broken down: by level, or by mark. */
export const ASK_BREAKDOWNS = ["LEVEL", "MARK"] as const;

/** One of the two. */
export type AskBreakdown = (typeof ASK_BREAKDOWNS)[number];

/** Where an answer was read from (§3's `ask_basis_*`). */
export const ASK_BASES = ["REGISTER", "SCHEDULES", "NOTES", "LEVELS", "SHEETS"] as const;

/** One of the five. */
export type AskBasis = (typeof ASK_BASES)[number];

/** The longest question the door reads, in characters, once trimmed (§6). */
export const ASK_QUESTION_MAX = 300;

/**
 * The register's lawful-null slot a foundation object is filed under (L-REG-04). A question about the
 * foundation reads it beside the stack's own foundation level (I-400).
 */
export const FOUNDATION_SLOT = "FOUNDATION";

/** The refusals an answer may carry — this area's five, read off the one register (Q-07). */
export const ASK_REFUSAL_CODES = Object.freeze({
  notUnderstood: REFUSALS.ASK_NOT_UNDERSTOOD.code,
  subjectUnknown: REFUSALS.ASK_SUBJECT_UNKNOWN.code,
  notMeasured: REFUSALS.ASK_NOT_MEASURED.code,
  estimateNotBuilt: REFUSALS.ASK_ESTIMATE_NOT_BUILT.code,
  judgementNotOffered: REFUSALS.ASK_JUDGEMENT_NOT_OFFERED.code,
});

/** One of the five codes above. */
export type AskRefusalCode = (typeof ASK_REFUSAL_CODES)[keyof typeof ASK_REFUSAL_CODES];

/* ------------------------------------------------------------------------------- the reading */

/**
 * What a question was read as, in THIS project's own labels (§1.1's "Understood as"). Every subject
 * is named the way the project names it — a mark and a level label verbatim, a class and a kind from
 * the catalogue's rosters — so a reading crossing the wire (a clarify's choice, a follow-up's
 * previous reading) is resolved again by the server against what the project holds, never trusted.
 */
export type AskReading = {
  readonly intent: AskIntent;
  readonly class: ElementType | null;
  readonly kind: Kind | null;
  readonly mark: string | null;
  /** A label of the live stack, or the foundation slot. */
  readonly level: string | null;
  readonly by: AskBreakdown | null;
  readonly noteKind: NoteKind | null;
  readonly discipline: Discipline | null;
  /** A unit the question named that the register does not measure in (`cft`), said, never converted (§7). */
  readonly unitAsked: string | null;
};

/** What the door is asked: the question, and where it comes from a clarify or a follow-up, a reading. */
export type AskStatement = {
  readonly question: string;
  /** The reading a person chose from a clarify, or a kept reading asked again (routed PERSON). */
  readonly reading?: AskReading | undefined;
  /** The reading of the answer a follow-up names a subject against ("and on 6F?"). */
  readonly previous?: AskReading | undefined;
};

/* ------------------------------------------------------------------------------- the sources */

/** One register object, as the register's one reader states it (`ViewObject` is a superset). */
export type AskObject = {
  readonly objectKey: string;
  readonly class: string;
  readonly mark: string;
  readonly level: string;
  /** The placement the object was read at (a placement key: its view, its mark, its point). */
  readonly sourceKey: string;
  readonly role: string;
  /** How its readings corroborate; `REPUDIATED` where a person struck it (I-173). */
  readonly corroboration: string;
};

/** One omitted component of a PARTIAL line, as the line enumerated it (L-QTY-02). */
export type AskOmission = { readonly variable: string; readonly code: string };

/** One published line, as the register's one reader states it (`ViewLine` is a superset). */
export type AskLine = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly class: string;
  readonly kind: string;
  readonly level: string;
  readonly value: string | null;
  readonly unit: string;
  readonly coverage: string;
  readonly omitted?: readonly AskOmission[];
  readonly repudiated: boolean;
  readonly drawingId: string | null;
  readonly layoutName: string | null;
  readonly sheetLabel: string | null;
  readonly traceKeys: readonly string[];
};

/** One sighting that produced no line: a deferral's cause or a refusal's code. */
export type AskRefusalRow = { readonly code: string; readonly objectKey: string; readonly kind: string | null };

/** One reading of a storey height, as the ledger holds it (L-MEA-07, D-001). */
export type AskHeightReading = {
  readonly readingKey: string;
  readonly basis: string;
  readonly sourceKey: string | null;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonicalMetres: string;
};

/** One live level of the stack, with how its storey height stands (`StackLevel` is a superset). */
export type AskLevel = {
  readonly levelId: string;
  readonly label: string;
  readonly ordinal: number;
  readonly height: {
    readonly standing: string;
    readonly canonicalMetres: string | null;
    readonly current: readonly AskHeightReading[];
  };
};

/** One committed reading of a general note (`NoteReadingRow` is a superset). */
export type AskNoteReading = {
  readonly readingKey: string;
  readonly drawingId: string;
  readonly layoutName: string;
  readonly kind: NoteKind;
  readonly sourceKey: string;
  readonly valueAsWritten: string;
  readonly unitAsWritten: string;
  readonly canonical: string;
};

/** One cell of a reconstructed schedule, as drawn (L-CAD-08). */
export type AskScheduleCell = { readonly columnIndex: number; readonly text: string; readonly sourceKeys: readonly string[] };

/** One band of a reconstructed schedule. */
export type AskScheduleRow = { readonly rowIndex: number; readonly cells: readonly AskScheduleCell[] };

/** One reconstructed schedule of the pinned revision, its header beside its rows (I-250). */
export type AskSchedule = {
  readonly scheduleKey: string;
  readonly viewKey: string;
  readonly title: string;
  readonly drawingId: string;
  readonly header: AskScheduleRow | undefined;
  readonly rows: readonly AskScheduleRow[];
};

/** One sheet of the pinned revision, named as its title block states it. */
export type AskSheet = {
  readonly drawingId: string;
  readonly layoutName: string;
  /** The number the title block states (`S-10`), or null where it states none. */
  readonly number: string | null;
  readonly title: string;
  readonly discipline: Discipline;
};

/**
 * One place an answer's evidence stands: a (drawing, layout), how a reader names it, and every key
 * the answer cites there. The viewer selects on one drawing and one layout (`selectionAddress`), so a
 * figure whose evidence stands on one place links there and one standing on more links to its answer's
 * evidence row (I-404).
 */
export type AskPlace = {
  readonly drawingId: string;
  readonly layoutName: string;
  /** The sheet's number, else the layout's name; null for model space, which the screen says in words. */
  readonly sheetLabel: string | null;
  readonly keys: readonly string[];
};

/** One entity of a drawing, as a citation needs it: its own words, and the sheet it stands on. */
export type AskEntity = {
  /** The drawing the entity was found on — the one named, or the first of the revision holding the key. */
  readonly drawingId: string;
  readonly text: string | null;
  readonly layoutName: string | null;
  readonly sheetLabel: string | null;
};

/**
 * What the engine reads — the register's one reader and its sibling readers, never a SUM of its own
 * (B-17). The two lookups are the Trace's own resolution, asked by the server of the records the
 * pinned revision was measured on (I-404): where a member stands and what its Trace selects there,
 * and where one cited entity stands with its words. A source the query does not need may be empty.
 */
export type AskSources = {
  readonly campaign: { readonly campaignId: string; readonly setRevisionId: string } | null;
  readonly objects: readonly AskObject[];
  readonly lines: readonly AskLine[];
  readonly refusals: readonly AskRefusalRow[];
  readonly stack: readonly AskLevel[];
  readonly notes: readonly AskNoteReading[];
  readonly schedules: readonly AskSchedule[];
  readonly sheets: readonly AskSheet[];
  /** Where one register object's member stands, and the keys its Trace selects there. */
  readonly memberAt: (objectKey: string) => AskPlace | null;
  /** One cited entity: on this drawing where one is named, else on the first drawing that holds the key. */
  readonly entityAt: (drawingId: string | null, key: string) => AskEntity | null;
};

/** The parts of the sources a query reads beyond the register and the stack, loaded only when asked. */
export const ASK_SOURCE_NEEDS = ["members", "notes", "schedules", "sheets", "entities"] as const;

/** One of them. */
export type AskSourceNeed = (typeof ASK_SOURCE_NEEDS)[number];

/* --------------------------------------------------------------------------------- the facts */

/**
 * One figure of an answer (I-398): the exact decimal, its unit (null for a count of members), its
 * kind (null for a count or a height), the places it is stated at, and where the members or entities
 * it rests on stand (I-404). The screen writes `formatUserFigure(statedAt(value, places))`.
 */
export type AskFigure = {
  readonly value: string;
  readonly unit: string | null;
  readonly kind: Kind | null;
  readonly places: number;
  readonly at: readonly AskPlace[];
};

/** How many of something, grouped by one registered code (or by none, where nothing was recorded). */
export type AskCodeCount = { readonly code: string | null; readonly count: number; readonly variables: readonly string[] };

/**
 * What an answer leaves out (I-399): the PARTIAL lines under the question, counted and grouped by each
 * code they omit under, and the registered objects under it with no line, grouped by the reason their
 * sighting was deferred or refused. Null where the answer rests on everything under the question.
 */
export type AskPartial = {
  readonly lines: number;
  readonly codes: readonly AskCodeCount[];
  readonly objects: number;
  readonly reasons: readonly AskCodeCount[];
};

/** One line an answer rests on, for the Rows (§1.1 6) and the Trace (`traceAddress`). */
export type AskLineRecord = {
  readonly lineId: string;
  readonly objectKey: string;
  readonly level: string;
  readonly mark: string;
  readonly class: string;
  readonly kind: string;
  readonly value: string | null;
  readonly unit: string;
  readonly places: number | null;
  readonly coverage: string;
  readonly omitted: readonly AskOmission[];
  readonly drawingId: string | null;
  readonly layoutName: string | null;
  readonly sheetLabel: string | null;
  readonly traceKeys: readonly string[];
};

/** One register object an answer rests on, with where its member stands (I-404). */
export type AskObjectRecord = {
  readonly objectKey: string;
  readonly level: string;
  readonly class: string;
  readonly mark: string;
  /** The placement it was read at — its view, its mark, its point. */
  readonly sourceKey: string;
  readonly place: AskPlace | null;
};

/**
 * One reading an answer rests on — a note's or a storey height's (§1.1 6's readings). A note value is
 * QUOTED only where its characters stand in the cited entity's normalised words (I-401); otherwise it,
 * and every storey-height reading, is a figure.
 */
export type AskReadingRecord = {
  readonly readingKey: string;
  /** The note kind, or the level label a storey height was read for. */
  readonly what: string;
  readonly sourceKey: string | null;
  readonly drawingId: string | null;
  readonly layoutName: string | null;
  readonly sheetLabel: string | null;
  /** The drawing's characters, where the value is a quote; null where it is stated as a figure. */
  readonly quote: string | null;
  readonly figure: AskFigure | null;
  /** The cited entity's own words — the clause a note was read off, the mark a height was read from. */
  readonly clause: string | null;
};

/** One schedule cell an answer quotes, under its column's header (§1.1 6's cells). */
export type AskCellRecord = {
  readonly scheduleKey: string;
  readonly schedule: string;
  readonly rowIndex: number;
  readonly column: string | null;
  /** The cell as drawn — the drawing's words, quoted (I-401). */
  readonly text: string;
  readonly sourceKeys: readonly string[];
  readonly drawingId: string;
  readonly place: AskPlace | null;
};

/** Every record an answer rests on, by what they are — the Rows disclosure's tables. */
export type AskRecords = {
  readonly lines: readonly AskLineRecord[];
  readonly objects: readonly AskObjectRecord[];
  readonly readings: readonly AskReadingRecord[];
  readonly cells: readonly AskCellRecord[];
  readonly sheets: readonly AskSheet[];
};

/**
 * Where members counted for one level are the members counted for others — a typical plan (I-404):
 * the view keys they were placed on, the levels that plan stands for in stack order, and how many
 * members it draws.
 */
export type AskTypical = { readonly views: readonly string[]; readonly levels: readonly string[]; readonly members: number };

/** One row of a breakdown by level or by mark. */
export type AskBreakdownRow = {
  readonly level: string | null;
  readonly mark: string | null;
  readonly class: string | null;
  /** Complete lines summed (a quantity), or objects counted (a count). */
  readonly count: number;
  readonly figure: AskFigure | null;
  /** PARTIAL lines standing on this row, never summed. */
  readonly partial: number;
};

/** A kind stated apart and never added (§1.2's word two kinds answer to — blinding beside concrete). */
export type AskApart = { readonly kind: Kind; readonly classes: readonly string[]; readonly figure: AskFigure; readonly lines: number };

/** One kind measured so far across classes (I-399). */
export type AskTrade = {
  readonly kind: Kind;
  readonly unit: string;
  readonly figure: AskFigure | null;
  readonly lines: number;
  readonly classes: readonly AskBreakdownRow[];
  /** The classes the catalogue measures this kind on that hold no line in this campaign. */
  readonly absent: readonly ElementType[];
};

/** A (class, kind) group of the campaign standing without a figure — every line PARTIAL. */
export type AskWithout = { readonly class: string; readonly kind: string; readonly count: number };

/** A note kind's readings disagreeing: how many different values they state, none chosen. */
export type AskNoteGroup = { readonly noteKind: NoteKind; readonly values: number; readonly readings: readonly AskReadingRecord[] };

/** A storey height, as the stack states it: its standing, its height at the millimetre, its readings. */
export type AskHeight = {
  readonly level: string;
  readonly standing: string;
  readonly figure: AskFigure | null;
  readonly readings: readonly AskReadingRecord[];
};

/** What a schedule states for one mark: its rows, cells verbatim (I-401). */
export type AskScheduleRowFacts = { readonly scheduleKey: string; readonly schedule: string; readonly rowIndex: number; readonly cells: readonly AskCellRecord[] };

/** The facts one intent answers with — the screen's statement rows (§3). */
export type AskStatementFacts =
  | {
      readonly intent: "COUNT";
      readonly count: AskFigure;
      /** Objects a person struck from the register under the question, never counted (I-173). */
      readonly struck: number;
      readonly typical: AskTypical | null;
    }
  | { readonly intent: "MARKS"; readonly total: AskFigure; readonly marks: readonly AskBreakdownRow[] }
  | {
      readonly intent: "QUANTITY";
      readonly figure: AskFigure | null;
      readonly lines: number;
      /** By level (from the ground up) or by mark (in the order a QS counts them), where asked. */
      readonly breakdown: readonly AskBreakdownRow[] | null;
      readonly apart: AskApart | null;
    }
  | {
      readonly intent: "MEASURED_SO_FAR";
      readonly trades: readonly AskTrade[];
      readonly without: readonly AskWithout[];
      readonly apart: AskApart | null;
    }
  | { readonly intent: "WHY_NOT_MEASURED"; readonly lines: number; readonly complete: number }
  | { readonly intent: "MEMBER_TYPE"; readonly rows: readonly AskScheduleRowFacts[] }
  | { readonly intent: "NOTE"; readonly groups: readonly AskNoteGroup[] }
  | { readonly intent: "LEVEL_HEIGHT"; readonly heights: readonly AskHeight[] }
  | { readonly intent: "SHEET_LIST"; readonly count: AskFigure; readonly sheets: readonly AskSheet[] };

/** An answer's facts: the statement, what it leaves out, where its evidence stands, what it rests on. */
export type AskFacts = {
  readonly statement: AskStatementFacts;
  readonly partial: AskPartial | null;
  /** One place per (drawing, layout) any cited key stands on, the members' sheets first (I-404). */
  readonly places: readonly AskPlace[];
  readonly records: AskRecords;
  readonly basis: AskBasis;
};

/** What a project holds of one kind of subject, listed beneath `ASK_SUBJECT_UNKNOWN` (§3's `ask_held_*`). */
export type AskHeld = {
  readonly subject: "MARKS" | "LEVELS" | "SHEETS" | "SCHEDULES" | "NOTES";
  readonly class: ElementType | null;
  readonly items: readonly string[];
};

/** How a level reading offered in a clarify counts (§3's level glosses). */
export type AskGloss = { readonly count: "FLOOR" | "STOREY"; readonly n: number; readonly label: string };

/** One reading a clarify offers (at most two), with its gloss where it is a level's. */
export type AskOffered = { readonly reading: AskReading; readonly gloss: AskGloss | null };

/** Why a clarify asks: a subject read two ways, two things asked, or the machine unsure of the words. */
export const ASK_CLARIFY_LEADS = ["AMBIGUOUS", "COMPOUND", "MACHINE"] as const;

/** One of the three. */
export type AskClarifyLead = (typeof ASK_CLARIFY_LEADS)[number];

/** What the door answers a question with. */
export type AskAnswer =
  | {
      readonly outcome: "ANSWERED";
      readonly routedBy: AskRoutedBy;
      readonly reading: AskReading;
      /** The question named only a subject and was read against the previous answer's reading. */
      readonly followUp: boolean;
      readonly facts: AskFacts;
      /** Where the machine routed it, the ledger row of that call (`data-call`, §1.1 2); absent otherwise. */
      readonly callId?: string;
    }
  /**
   * A question back to the person. `MACHINE`: the machine routed the words below its confidence floor
   * and offers the readings it ranked highest ("Did you mean …", I-396).
   */
  | { readonly outcome: "CLARIFY"; readonly lead: AskClarifyLead; readonly offered: readonly AskOffered[] }
  | { readonly outcome: "REFUSED"; readonly code: AskRefusalCode; readonly reading: AskReading | null; readonly held: AskHeld | null };

/** The refusal half of the union, as the engine builds it. */
export type AskRefused = Extract<AskAnswer, { outcome: "REFUSED" }>;

/** A code is one of this area's five. */
export function isAskRefusalCode(code: RefusalCode): code is AskRefusalCode {
  return (Object.values(ASK_REFUSAL_CODES) as readonly string[]).includes(code);
}
