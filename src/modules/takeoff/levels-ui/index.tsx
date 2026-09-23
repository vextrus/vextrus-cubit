"use client";
// S-Levels' workspace — the level stack, cut from the grid-workspace template S-Takeoff established
// (docs/design/s-levels.md; Design Direction 00 §3.2). One DataTable of the live stack, the
// campaign's index beside it as a 240 px rail, the shell's ONE inspector filled on selection, and
// the lane's tabs-row aside holding the one primary.
//
// I-170, as this screen inherits it: ARCH-01 bars `src/modules` from importing `src/ui`, and B-17
// bars a screen from re-implementing a shipped primitive — so the renderers, the two mounts and the
// ids this screen publishes all arrive as chrome from the one file that may reach both trees.
//
// Every act here is a door and nothing more (L-ACT-02, I-243): the screen previews at the door,
// renders a rejection through the one RefusalState, and opens the one ConsequenceDialog only over a
// Consequence that was answered. Nothing on this screen commits anything itself.
//
// Nothing here re-derives a figure (I-241, B-17): a standing, a coverage and a roll-up's total are
// all `levelsViewOf`'s answers, rendered as they stand — the Foundation's and the unplaced lines' rows
// among them (I-433).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { AuthorStoreyHeightInput, AuthorTypicalRangeInput, Consequence, InsertLevelStatement, RepudiateLevelInput } from "@/core/acts";
import { isKind } from "@/core/catalogue/kinds";
// The places each kind's figure is written to (L-MEA-04's catalogue), read where the draft BOQ reads
// them, so a roll-up and the bill state one level's concrete at the same precision (I-lev-1) — and
// the one rule a page says a kind by, so a roll-up column and the register say it alike (I-352).
import { inWords, placesOf } from "@/core/documents/kinds/boq-draft-law";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { formatDate, formatMoney, formatUserFigure, dhakaDateParts } from "@/core/format";
import { STOREY_HEIGHT_BASES } from "@/core/levels/law";
import type { QuantityBasis } from "@/core/offers/law";
import { CANONICAL_UNIT, UNITS, dimensionOf, isUnit } from "@/core/units/canon";
// A stored decimal stated at a fraction length, half-up on the text (B-07) — the bar schedule's home.
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { LEVELS_COPY, fillCopy } from "./copy";
import type { LevelsView, LevelsViewLevel, LevelsViewRange, LevelsViewReading, LevelsViewRollup, LevelsViewSlot } from "./view";

/* ------------------------------------------------------------------ what the screen is handed */

/**
 * One row of the stack table: a live level, or a row that is no level — the Foundation beneath the
 * stack, or the lines that stand on no live level (I-433). A slot row carries roll-ups and nothing
 * else: no surrogate, no ordinal, no storey height, and no inspector (L-REG-02).
 */
export type StackRow = {
  readonly rowId: string;
  readonly level: LevelsViewLevel | null;
  readonly slot: LevelsViewSlot["slot"] | null;
  readonly rollups: readonly LevelsViewRollup[];
};

/** One cell of the stack table, as the shipped DataTable hands one its row. */
type LevelCell = { readonly row: { readonly original: StackRow } };

/** One column of the stack table, as the shipped DataTable takes one. */
type LevelColumn = {
  id: string;
  header: string;
  accessorFn?: (row: StackRow) => string;
  enableSorting?: boolean;
  /** The width the column is READ at (§5 rule 3), never the primitive's 150. */
  size?: number;
  cell: (context: LevelCell) => ReactNode;
  meta?: { align?: "right" };
};

/** Where a refusal is resolved — the one evidence shape the refusal pattern rules. */
type Evidence = { href: string; label: string };

/**
 * THE IDS THIS SCREEN PUBLISHES THAT IT MAY NOT SPELL (AM-09 §1, ARCH-01). `src/ui/testids.ts` is
 * the one declaration of every test id and a module may not import it, so they arrive as chrome —
 * exactly as `DataTable` and `EnumLabel` do. Every string is the registry's own.
 */
export interface LevelsTestIds {
  readonly screen: string;
  readonly grid: string;
  readonly row: string;
  readonly rollup: string;
  readonly empty: string;
  readonly insert: string;
  readonly insertLabel: string;
  readonly insertOrdinal: string;
  readonly insertConfirm: string;
  readonly inspector: string;
  readonly reading: string;
  readonly heightValue: string;
  readonly heightUnit: string;
  readonly heightBasis: string;
  readonly heightSource: string;
  readonly authorHeight: string;
  readonly repudiate: string;
  readonly ranges: string;
  readonly rangeRow: string;
  readonly rangeFrom: string;
  readonly rangeTo: string;
  readonly authorRange: string;
}

/** The shipped renderers the app layer injects (I-170), each declared by the props this screen hands it. */
export interface LevelsChrome {
  readonly testIds: LevelsTestIds;
  readonly DataTable: ComponentType<{
    tableId: string;
    columns: LevelColumn[];
    data: StackRow[];
    getRowId: (row: StackRow, index: number) => string;
    freezeKeyColumn?: boolean;
    onRowSelect?: (rowIds: readonly string[]) => void;
    /** What each row publishes of its own — the level it stands for, as §7's contract spells it. */
    rowDataOf?: (row: StackRow, rowId: string) => Readonly<Record<string, string>>;
    /** The id a row carries: this screen's own `levels-row`, not the primitive's (AM-09 §1). */
    rowTestId?: string;
    "aria-label"?: string;
  }>;
  readonly RefusalState: ComponentType<{ refusal: RefusalEntry; evidence: Evidence }>;
  readonly ConsequenceDialog: ComponentType<{
    open: boolean;
    actType: string;
    preview: () => Promise<{ consequence: Consequence; consequenceDigest: string }>;
    commit: (carried: { consequenceDigest: string }) => Promise<{ actId: string }>;
    onOpenChange: (open: boolean) => void;
    onCommitted: (committed: { actId: string }) => void;
  }>;
  readonly EmptyState: ComponentType<{ heading: string; body?: string; children?: ReactNode; className?: string; "data-testid"?: string }>;
  readonly Button: ComponentType<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "act";
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children?: ReactNode;
    "data-testid"?: string;
    "data-permission"?: string;
  }>;
  readonly Input: ComponentType<{
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    className?: string;
    placeholder?: string;
    "aria-label"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "data-testid"?: string;
  }>;
  /** R-UI-083: a figure is written in the shipped NumberInput, never a bare `input type=number`. */
  readonly NumberInput: ComponentType<{
    value: string;
    onChange: (value: string) => void;
    step?: number;
    className?: string;
    "aria-label"?: string;
    "aria-invalid"?: boolean;
    "data-testid"?: string;
  }>;
  /** R-UI-083: a roster is chosen at the shipped Select, never a native `select`. */
  readonly Select: ComponentType<{
    options: readonly { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    "aria-label"?: string;
    "data-testid"?: string;
  }>;
  readonly Skeleton: ComponentType<{ style?: CSSProperties; className?: string }>;
  readonly IdChip: ComponentType<{ value: string; short?: string; className?: string; "data-testid"?: string }>;
  readonly EnumLabel: ComponentType<{ value: string; label?: string; className?: string; "data-testid"?: string }>;
  readonly BasisChip: ComponentType<{ basis: QuantityBasis }>;
  readonly CoverageChip: ComponentType<{ value: number }>;
  readonly QuantityText: ComponentType<{
    value: string;
    unit?: string;
    format?: { figure: (value: string) => string; money: (amount: string) => string; date: (at: Date) => string };
    className?: string;
    "data-testid"?: string;
  }>;
  readonly UnitBadge: ComponentType<{ unit: string }>;
  readonly Tooltip: ComponentType<{ content: ReactNode; children: ReactNode }>;
  /** The insert form's home: anchored on the one primary, never a row of fields in a 32 px track. */
  readonly Popover: ComponentType<{ open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }>;
  readonly PopoverTrigger: ComponentType<{
    children?: ReactNode;
    className?: string;
    disabled?: boolean;
    "data-variant"?: string;
    "data-testid"?: string;
    "data-permission"?: string;
  }>;
  readonly PopoverContent: ComponentType<{ children?: ReactNode; className?: string; "aria-label"?: string }>;
  /** `ASSIGN_ROLE` → `Assign role`, in the one home EnumLabel humanises by (B-17). */
  readonly humaniseEnum: (value: string) => string;
  /** THE TWO MOUNTS (Direction §1, §3.2): the lane's tabs row, and the frame's ONE inspector. */
  readonly TabsAside: ComponentType<{ children?: ReactNode }>;
  readonly InspectorMount: ComponentType<{ children?: ReactNode }>;
}

/** What a preview answers (L-ACT-02): the typed Consequence, and the digest that binds it. */
export type PreviewAnswer = { consequence: Consequence; consequenceDigest: string };

/** The doors this screen presses — the takeoff lane's own, as `src/server/routers/takeoff.ts` takes them. */
export interface LevelsDoors {
  readonly levels: (argument: { projectId: string }) => Promise<{ stack: readonly LevelsViewLevel[]; slots?: readonly LevelsViewSlot[]; unstatedRanges: readonly LevelsViewRange[] }>;
  readonly previewInsertLevel: (argument: { input: InsertLevelStatement }) => Promise<PreviewAnswer>;
  readonly commitInsertLevel: (argument: { input: InsertLevelStatement; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewRepudiateLevel: (argument: { input: RepudiateLevelInput }) => Promise<PreviewAnswer>;
  readonly commitRepudiateLevel: (argument: { input: RepudiateLevelInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewAuthorStoreyHeight: (argument: { input: AuthorStoreyHeightInput }) => Promise<PreviewAnswer>;
  readonly commitAuthorStoreyHeight: (argument: { input: AuthorStoreyHeightInput; consequenceDigest: string }) => Promise<{ actId: string }>;
  readonly previewAuthorTypicalRange: (argument: { input: AuthorTypicalRangeInput }) => Promise<PreviewAnswer>;
  readonly commitAuthorTypicalRange: (argument: { input: AuthorTypicalRangeInput; consequenceDigest: string }) => Promise<{ actId: string }>;
}

export interface LevelsWorkspaceProps {
  readonly view: LevelsView;
  /** Which of the three permissions the reader holds, read server-side (Decision §2, I-247). */
  readonly permitted: Readonly<Record<string, boolean | undefined>>;
  readonly offline: boolean;
  /**
   * The state the ROUTE holds this screen in — `loading` while it waits and `error` where the read
   * faulted, both of which are facts about the read rather than about the stack. Left null, the
   * screen derives its own (§2's order, first holding wins).
   */
  readonly state?: string | null;
  /** The level a reader has already selected, where the caller mounts with a selection made. */
  readonly level?: string | null;
  /** The fault the read left behind, quoted verbatim in the error cell (R-UI-050, B-21). */
  readonly reportId?: string | null;
  /** The read's own retry, where the caller holds the read: the error cell's one door (R-UI-050). */
  readonly onRetry?: () => void;
  readonly chrome: LevelsChrome;
  readonly doors: LevelsDoors;
}

/* --------------------------------------------------------------------------- the addresses */

// The one address this screen links: where a denial is resolved. ARCH-01 bars a module from the app
// layer where a route builder lives, so it is spelled here for this screen and nowhere else in it.
const participantsHref = (projectId: string): string => `/p/${projectId}/settings/participants`;

/** The permission each door on this screen moves (L-ACT-03, Decision §2's denial table). */
export const AUTHOR_LEVEL_STACK = "AUTHOR_LEVEL_STACK";
export const AUTHOR_PROJECT_FACT = "AUTHOR_PROJECT_FACT";
export const MEASURE = "MEASURE";

/** The four act types this screen confirms, verbatim as the act seam names them. */
const INSERT_LEVEL = "INSERT_LEVEL" as const;
const REPUDIATE_LEVEL = "REPUDIATE_LEVEL" as const;
const AUTHOR_STOREY_HEIGHT = "AUTHOR_STOREY_HEIGHT" as const;
const AUTHOR_TYPICAL_RANGE = "AUTHOR_TYPICAL_RANGE" as const;

/** The code the screen's own denial renders, off the registry it is looked up in (R-UI-020). */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** The standing a level's height stands at when its readings agree — the only one that shows metres. */
const AGREED = "AGREED";
const SUSPENDED = "SUSPENDED";
/** The standing of a height nobody has read. §1 says it in the screen's own words, not the wire's. */
const NONE = "NONE";

/** L-QTY-02's weaker coverage, which a cell states with no figure at all (I-241). */
const PARTIAL_DECLARED = "PARTIAL_DECLARED";

/** The identity the stack table's column furniture is remembered under (§5 rule 3). */
const LEVELS_TABLE_ID = "takeoff-level-stack";

/**
 * The column widths §5 fixes, in the closed set the Decision's own token rule admits (I-lev-1,
 * I-434). The roll-ups are the figures a quantity surveyor opens this screen for, so they take what
 * the three fixed columns leave. The standing says one thing — the word, and metres where they agree
 * (`Agreed 3.353 m`, 115 px measured at 1440) — so it stands at 152, not the 200 it held.
 */
const WIDTH_LEVEL = 144;
const WIDTH_ORDINAL = 64;
const WIDTH_STANDING = 152;
/** What the three fixed columns take together. */
const WIDTH_FIXED = WIDTH_LEVEL + WIDTH_ORDINAL + WIDTH_STANDING;
/**
 * A roll-up's widest: `26 lines 15.225 m³ 100%` (208 px measured at 1440) whole inside the cell's
 * padding, with room for a three-digit count. It is also the width every roll-up takes when the
 * kinds in view cannot share the grid at a width that says a figure — then the grid scrolls sideways
 * under its frozen Level column, and nothing in it is cut.
 */
const WIDTH_ROLLUP = 240;
/**
 * The least a roll-up is narrowed to so that the kinds in view stand in view: the count, the figure
 * and its unit whole (`26 lines 16.828 m³`, 156 px), the chip or a code after them ending in the
 * table's own ellipsis and Tooltip (§1). Narrower than this a roll-up would say no figure at all.
 */
const WIDTH_ROLLUP_MIN = 176;
/**
 * What the grid keeps clear at its trailing edge: the table's `⋯` over the header's last `--row-h`
 * and the last column's 24 px resize target beside it, plus a vertical scroller (R-UI-012, SC 2.5.8)
 * — the s-bbs allowance, for the same table.
 */
const TRAILING_ALLOWANCE = 40;
/** Widths stay on the 4 px grid the rest of the screen stands on. */
const GRID_STEP = 4;
/**
 * The grid's width before it is measured — the server's paint, a suite with no layout: the grid at
 * 1440 × 900 with nothing selected (1092 px measured, §1), the viewport the journey lane reads. A
 * paint there is already the measured one, so the pictures never catch a first paint that moves.
 */
const UNMEASURED_GRID = 1092;

/**
 * The width each roll-up column is read at (I-434), derived as s-bbs derives its Dimensions column:
 * from the grid's measured width and how many kinds must stand IN VIEW — the kinds the live levels
 * bear, the frame every storey's row reads (`kindsOf`'s lead). Where those fit at a width that still
 * says a figure, they share what the fixed columns leave, on the 4 px grid and never wider than 240,
 * and any kind only the Foundation bears follows them at the same width, a scroll away under the
 * frozen Level column. Where even they cannot, each takes its whole 240 and the grid scrolls: a stack
 * of cells cut to `26 li…` reads as nothing, while a scroll hides no figure.
 */
export function rollupWidthOf(gridWidth: number | null, kindsInView: number): number {
  if (kindsInView <= 0) return WIDTH_ROLLUP;
  const room = (gridWidth ?? UNMEASURED_GRID) - WIDTH_FIXED - TRAILING_ALLOWANCE;
  const share = Math.floor(room / kindsInView / GRID_STEP) * GRID_STEP;
  if (share >= WIDTH_ROLLUP) return WIDTH_ROLLUP;
  return share >= WIDTH_ROLLUP_MIN ? share : WIDTH_ROLLUP;
}

/**
 * The code a height's standing already SAYS: `Not stated` is STOREY_HEIGHT_UNSTATED and `Suspended`
 * is STOREY_HEIGHT_CONTESTED. Printed beside its own standing it read `Not stated · Storey height
 * unstated` — one fact twice (§6's copy diet, I-lev-2). A code any other standing carried would be a
 * second fact, and still stands.
 */
const CODE_SAID_BY: Readonly<Record<string, string>> = { NONE: "STOREY_HEIGHT_UNSTATED", SUSPENDED: "STOREY_HEIGHT_CONTESTED" };

/**
 * The figure conventions at one kind's display precision (I-lev-1): the roll-up's exact sum stays in
 * `data-value` and its face is stated at the places the catalogue writes the kind to — `15.225`, not
 * `15.22476` clipped at the cell's edge. A kind the catalogue does not hold keeps the exact face.
 */
const FIGURES_AT = new Map<number, typeof FIGURES>();
function figuresAt(places: number): typeof FIGURES {
  const held = FIGURES_AT.get(places);
  if (held !== undefined) return held;
  const made = Object.freeze({ ...FIGURES, figure: (value: string): string => formatUserFigure(statedAt(value, places)) });
  FIGURES_AT.set(places, made);
  return made;
}

function figuresOfKind(kind: string): typeof FIGURES {
  return isKind(kind) ? figuresAt(placesOf(kind)) : FIGURES;
}

/** How finely a height and an ordinal are stepped where a reader uses the control's own arrows. */
const HEIGHT_STEP = 0.001;
const ORDINAL_STEP = 1;

/**
 * The places a storey height's face is stated to in the grid (I-352): the millimetre, the step the
 * height form itself takes (`HEIGHT_STEP`), so every AGREED height reads at one precision —
 * `3.353` beside `3.048`, never `3.3528` beside `3.048`. The exact metres stay on the row's
 * `data-metres`, on the figure's `data-value`, and whole in the inspector (L-QTY-03, as I-reg-2
 * keeps a register figure).
 */
const HEIGHT_PLACES = 3;

/** SEAM-FORMAT, as the figure primitives take it (§5 rule 5's lakh/crore), handed down from core. */
const FIGURES = Object.freeze({
  figure: formatUserFigure,
  money: formatMoney,
  date: (at: Date): string => formatDate(dhakaDateParts(at)),
});

/**
 * The units a storey height may be written in: the canon's own LENGTH roster, read off the table
 * that carries the factors rather than transcribed beside it (B-17, B-19). The canonical metre leads,
 * because that is what a reader writing a height in this form most often writes.
 */
const HEIGHT_UNITS: readonly string[] = Object.freeze([
  CANONICAL_UNIT.LENGTH,
  ...UNITS.filter((unit) => dimensionOf(unit) === "LENGTH" && unit !== CANONICAL_UNIT.LENGTH),
]);

/** What a door answered that the screen shows in place: one registered refusal, or nothing. */
type Answer = { refusal: RefusalEntry; evidence: Evidence } | null;

/** The act a confirmed door opened the one dialog over, with the input it will be committed on. */
type Pending =
  | { readonly actType: typeof INSERT_LEVEL; readonly input: InsertLevelStatement }
  | { readonly actType: typeof REPUDIATE_LEVEL; readonly input: RepudiateLevelInput }
  | { readonly actType: typeof AUTHOR_STOREY_HEIGHT; readonly input: AuthorStoreyHeightInput }
  | { readonly actType: typeof AUTHOR_TYPICAL_RANGE; readonly input: AuthorTypicalRangeInput };

/** A height being written in the inspector, before it is previewed at the door (I-243). */
type HeightDraft = { value: string; unit: string; basis: string; sourceKey: string };

/** The draft a selected level's form starts from: nothing written, the metre, the first lawful basis. */
const HEIGHT_DRAFT: HeightDraft = Object.freeze({ value: "", unit: CANONICAL_UNIT.LENGTH, basis: STOREY_HEIGHT_BASES[0], sourceKey: "" });

/**
 * Which field of the height form a press found empty (I-435). Refused on the field, where it is
 * typed, and never sent: a height with no figure is no reading, and one that cites no drawing entity
 * binds no `H` (`STOREY_HEIGHT_UNCITED`), so every quantity measured through the level would publish
 * partial behind an `Agreed` standing that looked whole.
 */
type HeightFault = { readonly value: boolean; readonly source: boolean };

/** The height form as it stands, and the level it was written for (I-435). */
type HeightForm = { readonly levelId: string | null; readonly draft: HeightDraft; readonly fault: HeightFault | null };

/** A typical range being written in the rail, stated as the two ordinals a plan stands for. */
type RangeDraft = { from: string; to: string };

/* ----------------------------------------------------------------------------- the readings */

/**
 * The registered code a rejection carries, however it arrived. `refusalCodeOf` is the marker's one
 * home; a failure carrying none is a fault, and a fault belongs to the error boundary (ARCH-03).
 */
function entryOf(code: string): RefusalEntry | undefined {
  return (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[code];
}

/**
 * The registered code a rejection carries, however it arrived. `refusalCodeOf` is the marker's one
 * home; a failure carrying none is a fault, and a fault belongs to the error boundary (ARCH-03).
 */
function codeOf(thrown: unknown): string | null {
  const direct = refusalCodeOf(thrown);
  if (direct !== null) return direct;
  const cause = (thrown as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : refusalCodeOf(cause);
}

/** The stack as it physically stands: by ordinal, and by surrogate where two share one (L-MEA-07). */
function inOrdinalOrder(stack: readonly LevelsViewLevel[]): LevelsViewLevel[] {
  return [...stack].sort((left, right) => left.ordinal - right.ordinal || (left.levelId < right.levelId ? -1 : left.levelId > right.levelId ? 1 : 0));
}

/** Code-point order, the order the reading answers kinds in. */
function byCodePoint(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Every kind the stored lines bear, one column each (I-433, I-434): first the kinds the live levels
 * bear — the frame every storey carries, so it leads on every row and is what must stand in view
 * (`lead`) — then the kinds only a row that is no level bears (the Foundation's piling, boring,
 * blinding and excavation), each run in code-point order. A stack whose levels bear no line at all
 * leads with every kind it has.
 */
function kindsOf(stack: readonly LevelsViewLevel[], slots: readonly LevelsViewSlot[]): { readonly kinds: readonly string[]; readonly lead: number } {
  const onLevels = new Set<string>();
  for (const level of stack) for (const rollup of level.rollups) onLevels.add(rollup.kind);
  const beneath = new Set<string>();
  for (const slot of slots) for (const rollup of slot.rollups) if (!onLevels.has(rollup.kind)) beneath.add(rollup.kind);
  const kinds = [...[...onLevels].sort(byCodePoint), ...[...beneath].sort(byCodePoint)];
  return { kinds, lead: onLevels.size > 0 ? onLevels.size : kinds.length };
}

/** The slot the register's lawful-null row beneath every level is answered under (I-433). */
const FOUNDATION_ROW = "FOUNDATION";
/** The row of the lines whose object stands on no live level (I-433). */
const UNPLACED_ROW = "UNPLACED";

/**
 * The grid's rows, as the stack physically stands (I-433): the Foundation beneath the lowest level,
 * the live levels in ordinal order, and last the lines no live level carries.
 */
function stackRowsOf(stack: readonly LevelsViewLevel[], slots: readonly LevelsViewSlot[]): StackRow[] {
  const slotRow = (slot: LevelsViewSlot): StackRow => ({ rowId: `slot:${slot.slot}`, level: null, slot: slot.slot, rollups: slot.rollups });
  return [
    ...slots.filter((slot) => slot.slot === FOUNDATION_ROW).map(slotRow),
    ...stack.map((level): StackRow => ({ rowId: level.levelId, level, slot: null, rollups: level.rollups })),
    ...slots.filter((slot) => slot.slot === UNPLACED_ROW).map(slotRow),
  ];
}

/**
 * The kinds some of whose lines stand on no live level (I-433). A level's roll-up of such a kind may
 * be leaving out lines that belong on it, so it wears no coverage chip: a `100%` over it would call a
 * floor whole that nobody can show is.
 */
function unplacedKindsOf(slots: readonly LevelsViewSlot[]): ReadonlySet<string> {
  return new Set(slots.filter((slot) => slot.slot === UNPLACED_ROW).flatMap((slot) => slot.rollups.map((rollup) => rollup.kind)));
}

/**
 * The words a standing is read by (§1's grid cells). AGREED and SUSPENDED are said by the one
 * mechanical rule every enum on the product is said by; a height nobody has read is *Not stated*,
 * which is this screen's own sentence for it — "None" is the wire value, and it reads as an absent
 * field rather than an unstated height (R-SPINE-060, EnumLabel's own `label`).
 */
function standingSaid(standing: string): string | undefined {
  return standing === NONE ? LEVELS_COPY.levels_standing_none : undefined;
}

/** The words a row that is no level is named by in the Level column (I-433, §3). */
function slotSaid(slot: StackRow["slot"]): string {
  return slot === FOUNDATION_ROW ? LEVELS_COPY.levels_slot_foundation : LEVELS_COPY.levels_slot_unplaced;
}

/** The one muted phrase such a row says where a level states its storey height (I-433, §3). */
function slotNoteSaid(slot: StackRow["slot"]): string {
  return slot === FOUNDATION_ROW ? LEVELS_COPY.levels_slot_foundation_note : LEVELS_COPY.levels_slot_unplaced_note;
}

/**
 * How many rows the grid DREW, read from the one place that knows it (B-17). The shipped table
 * windows its rows once the stack is long enough and publishes the number it in fact put in the
 * document; the screen's region carries the id a retrying read waits on (§7 C10), so it repeats the
 * table's own number rather than restating the length of the data it handed over — a region that
 * said "200 rows" over a table that drew forty would have a read wait on rows that are not there.
 *
 * The first render says the length of the stack, which is what a table that has windowed nothing
 * draws and what the server's own paint carries; the table corrects it as soon as it stands, and the
 * observer keeps it corrected as the window moves under a scroll.
 */
function useRowsDrawn(region: RefObject<HTMLElement | null>, rows: number): number {
  const [drawn, setDrawn] = useState(rows);
  useEffect(() => {
    const host = region.current;
    if (host === null) return;
    const read = (): void => {
      const said = host.querySelector("[data-rows-rendered]")?.getAttribute("data-rows-rendered");
      const count = said === null || said === undefined ? Number.NaN : Number(said);
      setDrawn(Number.isFinite(count) ? count : rows);
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(host, { attributes: true, attributeFilter: ["data-rows-rendered"], subtree: true, childList: true });
    return () => watch.disconnect();
  }, [region, rows]);
  return drawn;
}

/**
 * What every row of the stack publishes of its own (§7's closed contract, I-242). A row that is no
 * level publishes the slot it stands for and none of a level's attributes (I-433): no surrogate a
 * pointer could select, and no ordinal a reader of the stack would count as a storey.
 */
function rowDataOf(row: StackRow, selected: string | null): Readonly<Record<string, string>> {
  const level = row.level;
  if (level === null) return { "data-slot": row.slot ?? "" };
  const published: Record<string, string> = {
    "data-level": level.levelId,
    "data-ordinal": String(level.ordinal),
    "data-standing": level.standing,
    "data-code": level.code ?? "",
    // I-242: a figure printed beside the word *suspended* is the very claim the suspension denies.
    "data-metres": level.standing === AGREED ? (level.canonicalMetres ?? "") : "",
  };
  if (level.levelId === selected) published["data-selected-level"] = "true";
  return published;
}

/* --------------------------------------------------------------------------- the workspace */

export function LevelsWorkspace({ view, permitted, offline, state, level, reportId, onRetry, chrome, doors }: LevelsWorkspaceProps) {
  const {
    testIds,
    DataTable,
    RefusalState,
    ConsequenceDialog,
    EmptyState,
    Button,
    Input,
    NumberInput,
    Select,
    IdChip,
    EnumLabel,
    BasisChip,
    CoverageChip,
    QuantityText,
    UnitBadge,
    Tooltip,
    humaniseEnum,
    TabsAside,
    InspectorMount,
  } = chrome;

  /**
   * The reading as it stands: the route's, until a committed act makes this screen read it again. A
   * reading that answers no rows beyond the levels holds none (`slots` absent is `[]`).
   */
  const [reading, setReading] = useState<{ stack: readonly LevelsViewLevel[]; slots: readonly LevelsViewSlot[]; unstatedRanges: readonly LevelsViewRange[] }>({
    stack: view.stack,
    slots: view.slots ?? [],
    unstatedRanges: view.unstatedRanges,
  });
  useEffect(() => {
    setReading({ stack: view.stack, slots: view.slots ?? [], unstatedRanges: view.unstatedRanges });
  }, [view]);

  const [selected, setSelected] = useState<string | null>(level ?? null);
  const [answer, setAnswer] = useState<Answer>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertDraft, setInsertDraft] = useState<{ label: string; ordinal: string }>({ label: "", ordinal: "" });
  const [heightForm, setHeightForm] = useState<HeightForm>({ levelId: null, draft: HEIGHT_DRAFT, fault: null });
  const [rangeDrafts, setRangeDrafts] = useState<Readonly<Record<string, RangeDraft>>>({});
  /** What a door left that no registry entry stands for: held here, raised in render (ARCH-03, B-21). */
  const [fault, setFault] = useState<unknown>(null);

  // I-435: the height form belongs to the level it stands under. A figure written for GF and left
  // unsent is not carried onto ROOF when ROOF is chosen, and neither is the field a press found empty:
  // a form held for another level reads as a fresh one for this.
  const heightDraft = heightForm.levelId === selected ? heightForm.draft : HEIGHT_DRAFT;
  const heightFault = heightForm.levelId === selected ? heightForm.fault : null;
  /** Write one change into the selected level's form, clearing the refusal on the field it answers. */
  const editHeight = useCallback(
    (change: (draft: HeightDraft) => HeightDraft, answers?: keyof HeightFault): void => {
      setHeightForm((held) => {
        const own = held.levelId === selected;
        const draft = own ? held.draft : HEIGHT_DRAFT;
        const refused = own ? held.fault : null;
        return { levelId: selected, draft: change(draft), fault: refused === null || answers === undefined ? refused : { ...refused, [answers]: false } };
      });
    },
    [selected],
  );

  const stack = useMemo(() => inOrdinalOrder(reading.stack), [reading.stack]);
  const columnKinds = useMemo(() => kindsOf(reading.stack, reading.slots), [reading.stack, reading.slots]);
  const kinds = columnKinds.kinds;
  const rows = useMemo(() => stackRowsOf(stack, reading.slots), [stack, reading.slots]);
  const unplacedKinds = useMemo(() => unplacedKindsOf(reading.slots), [reading.slots]);
  /** The live stack as a roster to choose a level from: in ordinal order, valued by surrogate. */
  const levelOptions = useMemo(() => stack.map((held) => ({ value: held.levelId, label: held.label })), [stack]);

  /** The primary region, and the number of rows the table inside it drew (§7 C10). */
  const gridRegion = useRef<HTMLDivElement>(null);
  const rowsDrawn = useRowsDrawn(gridRegion, rows.length);

  /**
   * The width the grid's region is READ at, so the roll-up columns can share what the fixed columns
   * leave (I-434) — measured as s-bbs measures its band, before the browser paints and again on every
   * resize (the inspector's arrival narrows it). Unmeasured — the server's paint, a suite with no
   * layout — the width is the grid's at the journey lane's viewport (`UNMEASURED_GRID`).
   */
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const box = gridRegion.current;
    if (box === null) return;
    const measure = (): void => setGridWidth(box.clientWidth > 0 ? box.clientWidth : null);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => watch.disconnect();
  }, [state]);
  const rollupWidth = rollupWidthOf(gridWidth, columnKinds.lead);

  const holdsStack = permitted[AUTHOR_LEVEL_STACK] === true;
  const holdsFact = permitted[AUTHOR_PROJECT_FACT] === true;
  const holdsMeasure = permitted[MEASURE] === true;

  const evidence = useMemo<Evidence>(() => ({ href: participantsHref(view.projectId), label: LEVELS_COPY.levels_denied_evidence }), [view.projectId]);

  /**
   * A rejection at a door, answered in place — never a toast, and never a dialog over nothing
   * (R-UI-020, I-245). A failure carrying no registered code is a fault, and a fault belongs to the
   * boundary that owns the report id: it is re-raised untouched rather than dressed as a refusal.
   */
  const refuse = useCallback(
    (code: string | null, thrown: unknown): void => {
      const entry = code === null ? undefined : entryOf(code);
      // Every caller of this helper is an event handler the browser invokes as a bare promise, so a
      // throw here would become a rejection nobody observes: the fault is held and re-raised in
      // render, which is where React's boundary — and the report id it mints — can see it.
      if (entry === undefined) {
        setFault(() => thrown);
        return;
      }
      setAnswer({ refusal: entry, evidence });
    },
    [evidence],
  );

  /** Read the stack again, which is what a committed act and the error cell's retry both need. */
  const reread = useCallback((): void => {
    void doors
      .levels({ projectId: view.projectId })
      .then((answered) => {
        setReading({ stack: answered.stack ?? [], slots: answered.slots ?? [], unstatedRanges: answered.unstatedRanges ?? [] });
      })
      .catch((thrown: unknown) => refuse(codeOf(thrown), thrown));
  }, [doors, refuse, view.projectId]);

  /**
   * A door, pre-flighted: a rejection is answered in place and opens NO dialog, and only an answered
   * Consequence opens one — whose own preview runs again, because L-ACT-02's digest must be the one
   * current state produces (the register's settled I-41).
   */
  const open = useCallback(
    async (act: Pending, preview: () => Promise<PreviewAnswer>): Promise<void> => {
      try {
        await preview();
      } catch (thrown) {
        refuse(codeOf(thrown), thrown);
        return;
      }
      setAnswer(null);
      setPending(act);
    },
    [refuse],
  );

  const openInsert = useCallback((): void => {
    const input: InsertLevelStatement = {
      type: INSERT_LEVEL,
      projectId: view.projectId,
      levels: [{ label: insertDraft.label, ordinal: Number(insertDraft.ordinal) }],
    };
    void open({ actType: INSERT_LEVEL, input }, () => doors.previewInsertLevel({ input }));
  }, [doors, insertDraft, open, view.projectId]);

  const openRepudiate = useCallback(
    (levelId: string): void => {
      const input: RepudiateLevelInput = { type: REPUDIATE_LEVEL, projectId: view.projectId, levelId };
      void open({ actType: REPUDIATE_LEVEL, input }, () => doors.previewRepudiateLevel({ input }));
    },
    [doors, open, view.projectId],
  );

  const openHeight = useCallback(
    (levelId: string): void => {
      // I-435: an empty figure and an empty source are refused on their own fields, where they are
      // typed, and the door previews nothing. A height that cites no drawing entity binds no `H`
      // (`STOREY_HEIGHT_UNCITED`): recorded, it would stand `Agreed` while every quantity measured
      // through the level published partial — so the evidence is asked for before the act, not after.
      const missing: HeightFault = { value: heightDraft.value.trim() === "", source: heightDraft.sourceKey.trim() === "" };
      const refused = missing.value || missing.source;
      setHeightForm({ levelId, draft: heightDraft, fault: refused ? missing : null });
      if (refused) return;
      const input: AuthorStoreyHeightInput = {
        type: AUTHOR_STOREY_HEIGHT,
        projectId: view.projectId,
        levelId,
        basis: heightDraft.basis,
        sourceKey: heightDraft.sourceKey.trim(),
        valueAsWritten: heightDraft.value,
        unitAsWritten: heightDraft.unit,
      };
      void open({ actType: AUTHOR_STOREY_HEIGHT, input }, () => doors.previewAuthorStoreyHeight({ input }));
    },
    [doors, heightDraft, open, view.projectId],
  );

  const openRange = useCallback(
    (range: LevelsViewRange): void => {
      const draft = rangeDrafts[range.viewKey] ?? { from: "", to: "" };
      // The reader chooses the two LEVELS a typical plan stands for, off the live stack in the order
      // it physically stands (§1's rail); a level is named by its surrogate and never by the ordinal
      // it happens to stand at today, which an insert moves (L-REG-02).
      const input: AuthorTypicalRangeInput = {
        type: AUTHOR_TYPICAL_RANGE,
        projectId: view.projectId,
        viewKey: range.viewKey,
        fromLevelId: draft.from,
        toLevelId: draft.to,
      };
      void open({ actType: AUTHOR_TYPICAL_RANGE, input }, () => doors.previewAuthorTypicalRange({ input }));
    },
    [doors, open, rangeDrafts, stack, view.projectId],
  );

  /* ------------------------------------------------------------- the lane's own tabs row (§3.2) */

  /**
   * The ONE primary, in the right half of the lane's 32 px tabs row (I-246). It stands there while a
   * live level exists and INSIDE the empty state while none does — one element, one id, exactly one
   * instance in the DOM at any time.
   */
  const insertDoor = useMemo(
    () => (
      <InsertDoor
        copy={LEVELS_COPY}
        testIds={testIds}
        held={holdsStack}
        offline={offline}
        open={insertOpen}
        onOpenChange={setInsertOpen}
        draft={insertDraft}
        onDraft={setInsertDraft}
        onConfirm={openInsert}
        chrome={chrome}
      />
    ),
    [chrome, holdsStack, insertDraft, insertOpen, offline, openInsert, testIds],
  );

  /* ----------------------------------------------------------- the shell's ONE inspector (§3.2) */

  const chosen = stack.find((held) => held.levelId === selected) ?? null;

  /**
   * What the frame's right column shows, or null — and null means NO COLUMN AT ALL, not a panel
   * saying nothing is selected (R-UI-080, §1). Memoised, because the slot is state in the frame and
   * a node with a new identity every render would set it on every render.
   */
  const inspector = useMemo<ReactNode>(() => {
    if (chosen === null) return null;
    return (
      <div className="cx-levels-inspector" data-testid={testIds.inspector} data-level={chosen.levelId} data-standing={chosen.standing}>
        <p className="cx-levels-inspector-title">
          <span className="cx-levels-inspector-label">{chosen.label}</span>
          <IdChip value={chosen.levelId} />
        </p>
        <dl className="cx-levels-facts">
          <dt>{LEVELS_COPY.levels_col_ordinal}</dt>
          <dd className="cx-levels-mono">{formatUserFigure(String(chosen.ordinal))}</dd>
          <dt>{LEVELS_COPY.levels_col_standing}</dt>
          <dd>
            <EnumLabel value={chosen.standing} label={standingSaid(chosen.standing)} className="cx-levels-enum" />
            {chosen.standing === AGREED && chosen.canonicalMetres !== null ? (
              <QuantityText value={chosen.canonicalMetres} unit={CANONICAL_UNIT.LENGTH} format={FIGURES} />
            ) : null}
          </dd>
        </dl>
        {chosen.standing === SUSPENDED ? <p className="cx-levels-suspended">{LEVELS_COPY.levels_suspended_note}</p> : null}

        <h3 className="cx-levels-section-heading">{LEVELS_COPY.levels_readings_heading}</h3>
        {chosen.readings.length === 0 ? <p className="cx-levels-no-readings">{LEVELS_COPY.levels_no_readings}</p> : null}
        {chosen.readings.map((held) => (
          <Reading key={held.readingKey + held.valueAsWritten + held.canonicalMetres} reading={held} testId={testIds.reading} BasisChip={BasisChip} QuantityText={QuantityText} />
        ))}

        {/* I-243: the form stands open and typing changes nothing — only the door previews. */}
        <div className="cx-levels-height-form">
          <label className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_value_label}</span>
            <NumberInput
              value={heightDraft.value}
              step={HEIGHT_STEP}
              data-testid={testIds.heightValue}
              aria-label={LEVELS_COPY.levels_height_value_label}
              aria-invalid={heightFault?.value === true ? true : undefined}
              onChange={(value) => editHeight((draft) => ({ ...draft, value }), "value")}
            />
          </label>
          {/* I-435: the field a press found empty says so under itself, and nothing was sent. */}
          {heightFault?.value === true ? (
            <p className="cx-levels-field-fault" role="alert" data-field="value">
              {LEVELS_COPY.levels_height_value_missing}
            </p>
          ) : null}
          {/* A Select's field is a div, not a label: the browser forwards a click inside a <label>
              to the control that label names, so choosing an option would immediately re-open the
              listbox it was chosen from — and the open list then covers the field below it. */}
          <div className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_unit_label}</span>
            <Select
              options={HEIGHT_UNITS.map((unit) => ({ value: unit, label: unit }))}
              value={heightDraft.unit}
              data-testid={testIds.heightUnit}
              aria-label={LEVELS_COPY.levels_height_unit_label}
              onChange={(unit) => editHeight((draft) => ({ ...draft, unit }))}
            />
          </div>
          <div className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_basis_label}</span>
            {/* I-244: exactly the three bases a height may be READ on, off the law's own roster —
                never DEFAULTED, which L-MEA-07 bars and the act would refuse. */}
            <Select
              options={STOREY_HEIGHT_BASES.map((basis) => ({ value: basis, label: humaniseEnum(basis) }))}
              value={heightDraft.basis}
              data-testid={testIds.heightBasis}
              aria-label={LEVELS_COPY.levels_height_basis_label}
              onChange={(basis) => editHeight((draft) => ({ ...draft, basis }))}
            />
          </div>
          <label className="cx-levels-field">
            <span>{LEVELS_COPY.levels_height_source_label}</span>
            <Input
              value={heightDraft.sourceKey}
              data-testid={testIds.heightSource}
              aria-label={LEVELS_COPY.levels_height_source_label}
              aria-describedby={heightFault?.source === true ? "levels-height-source-fault levels-height-source-hint" : "levels-height-source-hint"}
              aria-invalid={heightFault?.source === true ? true : undefined}
              onChange={(event) => editHeight((draft) => ({ ...draft, sourceKey: event.target.value }), "source")}
            />
          </label>
          {heightFault?.source === true ? (
            <p className="cx-levels-field-fault" role="alert" id="levels-height-source-fault" data-field="source">
              {LEVELS_COPY.levels_height_source_missing}
            </p>
          ) : null}
          <p className="cx-levels-hint" id="levels-height-source-hint">
            {LEVELS_COPY.levels_height_source_hint}
          </p>
          <Door
            testId={testIds.authorHeight}
            permission={AUTHOR_PROJECT_FACT}
            label={LEVELS_COPY.levels_author_height}
            denial={LEVELS_COPY.levels_denied_height}
            held={holdsFact}
            offline={offline}
            variant="secondary"
            onPress={() => openHeight(chosen.levelId)}
            Button={Button}
            Tooltip={Tooltip}
          />
          <Door
            testId={testIds.repudiate}
            permission={AUTHOR_LEVEL_STACK}
            label={LEVELS_COPY.levels_repudiate}
            denial={LEVELS_COPY.levels_denied_stack}
            held={holdsStack}
            offline={offline}
            variant="ghost"
            onPress={() => openRepudiate(chosen.levelId)}
            Button={Button}
            Tooltip={Tooltip}
          />
        </div>
      </div>
    );
  }, [
    BasisChip,
    Button,
    EnumLabel,
    IdChip,
    Input,
    NumberInput,
    QuantityText,
    Select,
    Tooltip,
    chosen,
    editHeight,
    heightDraft,
    heightFault,
    holdsFact,
    holdsStack,
    humaniseEnum,
    offline,
    openHeight,
    openRepudiate,
    testIds,
  ]);

  /* ------------------------------------------------------------------ the stack table's columns */

  const columns: LevelColumn[] = [
    {
      id: "level",
      header: LEVELS_COPY.levels_col_level,
      accessorFn: (held) => held.level?.label ?? slotSaid(held.slot),
      size: WIDTH_LEVEL,
      // R-UI-082: the surrogate renders as an IdChip beside the label, never woven into a sentence.
      // I-433: a row that is no level is named in words and carries no surrogate at all.
      cell: ({ row }) => {
        const held = row.original.level;
        if (held === null) {
          return (
            <span className="cx-levels-cell-level">
              <span className="cx-levels-label">{slotSaid(row.original.slot)}</span>
            </span>
          );
        }
        return (
          <span className="cx-levels-cell-level">
            <span className="cx-levels-label">{held.label}</span>
            <IdChip value={held.levelId} />
          </span>
        );
      },
    },
    {
      id: "ordinal",
      header: LEVELS_COPY.levels_col_ordinal,
      meta: { align: "right" },
      accessorFn: (held) => (held.level === null ? "" : String(held.level.ordinal)),
      size: WIDTH_ORDINAL,
      // A row that is no level stands at no ordinal: the cell is left empty rather than dashed, because
      // a dash would state an absence where there is nothing to be absent (I-433).
      cell: ({ row }) => (row.original.level === null ? null : <span className="cx-levels-mono">{formatUserFigure(String(row.original.level.ordinal))}</span>),
    },
    {
      id: "standing",
      header: LEVELS_COPY.levels_col_standing,
      accessorFn: (held) => held.level?.standing ?? "",
      size: WIDTH_STANDING,
      // I-242: the standing in words, and a figure ONLY where the readings agreed on one.
      // I-lev-2: the code stays on `data-code` for a machine, and is said aloud only where it adds a
      // fact the standing word does not already say. I-433: a row that is no level has no storey
      // height, and says in one muted phrase where it stands instead.
      cell: ({ row }) => {
        const held = row.original.level;
        if (held === null) return <span className="cx-levels-slot-note">{slotNoteSaid(row.original.slot)}</span>;
        return (
          <span className="cx-levels-cell-standing" data-code={held.code ?? ""}>
            <EnumLabel value={held.standing} label={standingSaid(held.standing)} className="cx-levels-enum" />
            {held.standing === AGREED && held.canonicalMetres !== null ? (
              <QuantityText value={held.canonicalMetres} format={figuresAt(HEIGHT_PLACES)} className="cx-levels-figure cx-levels-height" />
            ) : null}
            {held.standing === AGREED && held.canonicalMetres !== null ? <UnitBadge unit={CANONICAL_UNIT.LENGTH} /> : null}
            {held.code === null || CODE_SAID_BY[held.standing] === held.code ? null : <EnumLabel value={held.code} className="cx-levels-enum cx-levels-code" />}
          </span>
        );
      },
    },
    ...kinds.map((kind) => ({
      id: `rollup:${kind}`,
      // I-352: the kind in words, by the draft BOQ's one rule (`rcc.concrete` → `Concrete`) — the word
      // the register's Kind column says the same kind by. The stored key stays on the column's id and
      // on every roll-up's `data-kind`, where a reader of the machine finds it.
      header: inWords(kind),
      // I-434: every roll-up at the one width the grid's measure leaves it.
      size: rollupWidth,
      // I-241: the cell states the STORED lines of that kind on that row, exactly as the reading
      // answered them. A row bearing no line of this kind bears no roll-up to state.
      cell: ({ row }: LevelCell) => {
        const held = row.original.rollups.find((rollup) => rollup.kind === kind);
        if (held === undefined) return <span className="cx-levels-none">{DASH}</span>;
        // I-433: a level's roll-up of a kind some of whose lines stand on no level may be leaving
        // lines out, so it states its figure and wears no chip; every other row keeps its own.
        const whole = row.original.level === null || !unplacedKinds.has(kind);
        return <Rollup rollup={held} whole={whole} testId={testIds.rollup} CoverageChip={CoverageChip} EnumLabel={EnumLabel} QuantityText={QuantityText} UnitBadge={UnitBadge} />;
      },
    })),
  ];

  // Thrown in render, where React's own boundary is: a rejected promise reaches no boundary at all,
  // and a press that raised a fault into one would otherwise return with nothing said (R-UI-020).
  if (fault !== null) throw fault;

  /* ------------------------------------------------------------------------------ the state */

  /**
   * §2's order, first holding wins. `denied` is the whole screen's only when EVERY door on it is
   * shut (I-247) — a reader who holds one of the three is not denied, and the doors say for
   * themselves which permission each wants. `partial` is the reading's own deferred half: the views
   * whose typical range nobody stated are shown in the rail and never hidden (R-UI-050's partial),
   * while a level's own code and a roll-up's coverage are stated on the row that carries them.
   */
  const derived = !holdsStack && !holdsFact && !holdsMeasure
    ? "denied"
    : offline
      ? "offline"
      : answer !== null
        ? "refused"
        : stack.length === 0
          ? "empty"
          : reading.unstatedRanges.length > 0
            ? "partial"
            : "ready";
  const shown = state ?? derived;
  const denied = shown === "denied";

  /** R-UI-050's error cell: the read failed, and the report id stands beside the one door that clears it. */
  if (shown === "error") {
    return (
      <div className="cx-levels" data-testid={testIds.screen} data-state="error">
        <div className="cx-levels-fault" role="alert">
          <h1 className="cx-levels-fault-heading">{LEVELS_COPY.levels_error_heading}</h1>
          <p className="cx-levels-fault-body">{LEVELS_COPY.levels_error_body}</p>
          <p className="cx-levels-report">
            <span className="cx-levels-report-label">{LEVELS_COPY.levels_report_label}</span>
            {reportId === undefined || reportId === null ? null : <IdChip value={reportId} />}
          </p>
          <Button variant="secondary" onClick={onRetry ?? reread}>
            {LEVELS_COPY.levels_retry}
          </Button>
        </div>
      </div>
    );
  }

  if (shown === "loading") {
    return (
      <div className="cx-levels cx-levels-loading" data-testid={testIds.screen} data-state="loading">
        <LoadingBones Skeleton={chrome.Skeleton} />
      </div>
    );
  }

  return (
    <div className="cx-levels" data-testid={testIds.screen} data-state={shown}>
      {/* The lane's tabs row and the frame's one inspector are filled, not drawn (§3.2, R-UI-080):
          each mount renders where its region is, and nothing where there is nothing to show. */}
      <TabsAside>{stack.length === 0 ? null : insertDoor}</TabsAside>
      <InspectorMount>{inspector}</InspectorMount>

      {/* I-lev-4: the screen names itself once, for heading navigation, clipped out of sight — the
          breadcrumb and the current tab already say `Levels` where a reader can see it (the
          register's `cx-register-title` idiom; §1's "no heading over the grid" stands). */}
      <h1 className="cx-levels-title">{LEVELS_COPY.levels_heading}</h1>

      {offline ? (
        <p className="cx-levels-offline" role="status">
          {LEVELS_COPY.levels_offline}
        </p>
      ) : null}

      {/* R-UI-020: a door's rejection renders in place, through the one renderer, never as a toast.
          The slot is live so an answer is spoken the moment it arrives (R-UI-012). */}
      <div className="cx-levels-answer" aria-live="polite">
        {denied ? (
          <>
            <p className="cx-levels-denied">{LEVELS_COPY.levels_denied_stack}</p>
            <p className="cx-levels-denied">{LEVELS_COPY.levels_denied_holder}</p>
            <Denied evidence={evidence} RefusalState={RefusalState} />
          </>
        ) : null}
        {answer === null ? null : <RefusalState refusal={answer.refusal} evidence={answer.evidence} />}
      </div>

      <div className="cx-levels-body">
        {/* I-240: the campaign's index stands BESIDE the grid, never under it — a view with no range
            is a fact ABOUT the stack rather than a level in it. */}
        <section className="cx-levels-panel cx-levels-ranges" data-testid={testIds.ranges}>
          {/* I-lev-3: the section's explanation is its heading's Tooltip, never a paragraph under it
              (R-UI-081, §6's copy diet — the register's own refusals-hint idiom). */}
          <Tooltip content={LEVELS_COPY.levels_ranges_hint}>
            <h2 className="cx-levels-panel-heading">{LEVELS_COPY.levels_ranges_heading}</h2>
          </Tooltip>
          {reading.unstatedRanges.length === 0 ? <p className="cx-levels-none-said">{LEVELS_COPY.levels_ranges_none}</p> : null}
          {reading.unstatedRanges.map((range) => (
            <div className="cx-levels-range-row" key={range.viewKey} data-testid={testIds.rangeRow} data-view={range.viewKey} data-code={range.code}>
              <p className="cx-levels-range-caption">
                <span>{range.caption}</span>
                <IdChip value={range.drawingId} />
              </p>
              {/* A field is a div rather than a label: a click inside a <label> is forwarded by the
                  browser to the control that label names, which re-opens a listbox the moment an
                  option in it is chosen. Every control below states its own name (`aria-label`). */}
              <div className="cx-levels-field">
                <span>{LEVELS_COPY.levels_range_from_label}</span>
                <Select
                  options={levelOptions}
                  value={rangeDrafts[range.viewKey]?.from ?? ""}
                  data-testid={testIds.rangeFrom}
                  aria-label={LEVELS_COPY.levels_range_from_label}
                  onChange={(from) => setRangeDrafts((held) => ({ ...held, [range.viewKey]: { from, to: held[range.viewKey]?.to ?? "" } }))}
                />
              </div>
              <div className="cx-levels-field">
                <span>{LEVELS_COPY.levels_range_to_label}</span>
                <Select
                  options={levelOptions}
                  value={rangeDrafts[range.viewKey]?.to ?? ""}
                  data-testid={testIds.rangeTo}
                  aria-label={LEVELS_COPY.levels_range_to_label}
                  onChange={(to) => setRangeDrafts((held) => ({ ...held, [range.viewKey]: { from: held[range.viewKey]?.from ?? "", to } }))}
                />
              </div>
              <Door
                testId={testIds.authorRange}
                permission={MEASURE}
                label={LEVELS_COPY.levels_author_range}
                denial={LEVELS_COPY.levels_denied_range}
                held={holdsMeasure}
                offline={offline}
                variant="secondary"
                onPress={() => openRange(range)}
                Button={Button}
                Tooltip={Tooltip}
              />
            </div>
          ))}
        </section>

        {/* The primary region. Nothing stands above it inside `shell-main` (I-240): no filter bar,
            no heading, no caption — the grid is what this screen is. The keyboard path into a row is
            the grid's own; this handler adds the pointer to it, reading the row a click landed on off
            the `data-level` the screen itself published (§5 rule 10, the register's I-236). */}
        <div
          ref={gridRegion}
          className="cx-levels-mount cx-levels-grid"
          data-testid={testIds.grid}
          data-rows-rendered={rowsDrawn}
          onClick={(event) => {
            const row = event.target instanceof Element ? event.target.closest("[data-level]") : null;
            const levelId = row?.getAttribute("data-level") ?? null;
            if (levelId === null) return;
            setSelected((held) => (held === levelId ? null : levelId));
          }}
        >
          {stack.length === 0 ? (
            // I-246: the ONE insert door, inside the empty state while the stack is empty — never a
            // second door that teaches two ways to do one thing.
            <EmptyState data-testid={testIds.empty} className="cx-levels-empty" heading={LEVELS_COPY.levels_empty_heading} body={LEVELS_COPY.levels_empty_body}>
              {insertDoor}
            </EmptyState>
          ) : (
            <DataTable
              tableId={LEVELS_TABLE_ID}
              columns={columns}
              data={rows}
              getRowId={(held) => held.rowId}
              freezeKeyColumn
              rowTestId={testIds.row}
              rowDataOf={(held) => rowDataOf(held, selected)}
              // A row that is no level has no inspector to fill (I-433): only a level is selected.
              onRowSelect={(ids) => setSelected(ids.find((id) => stack.some((held) => held.levelId === id)) ?? null)}
              aria-label={LEVELS_COPY.levels_grid_label}
            />
          )}
        </div>
      </div>

      {pending === null ? null : (
        <ConsequenceDialog
          open
          actType={pending.actType}
          preview={previewOf(doors, pending, evidence)}
          commit={commitOf(doors, pending, evidence)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPending(null);
          }}
          onCommitted={() => {
            setPending(null);
            setInsertOpen(false);
            // The stack moved, so the screen reads it again: what a roll-up and a standing say is the
            // record's answer, never this screen's arithmetic over what it just sent (I-241).
            reread();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------ the pieces */

/** The em dash a cell states an absence with — never a zero, which would be a figure (L-QTY-02). */
const DASH = "—";

/** The same rejection, shaped as the one ConsequenceDialog reads one (its I-40). */
function refused(thrown: unknown, evidence: Evidence): never {
  const code = codeOf(thrown);
  const entry = code === null ? undefined : entryOf(code);
  if (entry === undefined) throw thrown;
  throw Object.assign(new Error(entry.code), { refusal: entry, evidence });
}

/** The preview the dialog runs for itself: state's own digest, taken again at the moment of showing. */
function previewOf(doors: LevelsDoors, act: Pending, evidence: Evidence): () => Promise<PreviewAnswer> {
  return async () => {
    try {
      if (act.actType === INSERT_LEVEL) return await doors.previewInsertLevel({ input: act.input });
      if (act.actType === REPUDIATE_LEVEL) return await doors.previewRepudiateLevel({ input: act.input });
      if (act.actType === AUTHOR_STOREY_HEIGHT) return await doors.previewAuthorStoreyHeight({ input: act.input });
      return await doors.previewAuthorTypicalRange({ input: act.input });
    } catch (thrown) {
      return refused(thrown, evidence);
    }
  };
}

/** The commit the dialog's confirm carries, bound to the digest it showed (L-ACT-02). */
function commitOf(doors: LevelsDoors, act: Pending, evidence: Evidence): (carried: { consequenceDigest: string }) => Promise<{ actId: string }> {
  return async (carried) => {
    try {
      if (act.actType === INSERT_LEVEL) return await doors.commitInsertLevel({ input: act.input, consequenceDigest: carried.consequenceDigest });
      if (act.actType === REPUDIATE_LEVEL) return await doors.commitRepudiateLevel({ input: act.input, consequenceDigest: carried.consequenceDigest });
      if (act.actType === AUTHOR_STOREY_HEIGHT) return await doors.commitAuthorStoreyHeight({ input: act.input, consequenceDigest: carried.consequenceDigest });
      return await doors.commitAuthorTypicalRange({ input: act.input, consequenceDigest: carried.consequenceDigest });
    } catch (thrown) {
      return refused(thrown, evidence);
    }
  };
}

/** The registered denial, rendered through the one renderer or not at all (R-UI-020, B-17). */
function Denied({ evidence, RefusalState }: { evidence: Evidence; RefusalState: LevelsChrome["RefusalState"] }) {
  const entry = entryOf(PERMISSION_NOT_HELD);
  if (entry === undefined) return null;
  return <RefusalState refusal={entry} evidence={evidence} />;
}

/**
 * One door of this screen (I-247). A reader who holds its permission presses the shipped Button; a
 * reader who does not is shown the same affordance, refusing the press and NAMING the permission
 * that would have carried it — a door that vanished teaches nobody what to ask for. The shut form is
 * the frame's own unavailable affordance (`cx-btn` chrome, `role="button"`, `aria-disabled`, in the
 * tab order), because the shipped Button reports `aria-disabled` for busy and for nothing else.
 */
function Door({
  testId,
  permission,
  label,
  denial,
  held,
  offline,
  variant,
  onPress,
  Button,
  Tooltip,
}: {
  testId: string;
  permission: string;
  label: string;
  denial: string;
  held: boolean;
  offline: boolean;
  variant: "primary" | "secondary" | "ghost";
  onPress: () => void;
  Button: LevelsChrome["Button"];
  Tooltip: LevelsChrome["Tooltip"];
}) {
  if (held && !offline) {
    return (
      <Button variant={variant} data-testid={testId} data-permission={permission} onClick={onPress}>
        {label}
      </Button>
    );
  }
  // Offline is not a denial. A reader who HOLDS the permission is told what is true — the connection
  // is gone and nothing can be committed (§2's offline cell) — and the door publishes no
  // `data-permission`, because claiming a permission this reader in fact holds would be a false
  // statement about their standing (R-UI-020, I-247).
  return <Shut testId={testId} permission={held ? null : permission} label={label} said={held ? LEVELS_COPY.levels_offline : denial} variant={variant} Tooltip={Tooltip} />;
}

/**
 * A door that will not open, wearing the frame's own unavailable affordance: the shipped Button
 * reports `aria-disabled` for busy and for nothing else, so a door shut for a reason of the screen's
 * own says so here (I-247). It names a permission only where a permission is what is missing.
 */
function Shut({
  testId,
  permission,
  label,
  said,
  variant,
  Tooltip,
}: {
  testId: string;
  permission: string | null;
  label: string;
  said: string;
  variant: "primary" | "secondary" | "ghost";
  Tooltip: LevelsChrome["Tooltip"];
}) {
  return (
    <Tooltip content={said}>
      <span
        className="cx-btn cx-reticle cx-levels-door-shut"
        data-variant={variant}
        role="button"
        tabIndex={0}
        aria-disabled="true"
        data-testid={testId}
        {...(permission === null ? {} : { "data-permission": permission })}
      >
        <span className="cx-btn-label">{label}</span>
      </span>
    </Tooltip>
  );
}

/**
 * The one primary and the form it opens (I-243, I-246): the fields change nothing, and the door
 * beside them previews. The form is a Popover anchored on the door because the door stands in a
 * 32 px track, where a row of fields is not a thing that can stand.
 */
function InsertDoor({
  copy,
  testIds,
  held,
  offline,
  open,
  onOpenChange,
  draft,
  onDraft,
  onConfirm,
  chrome,
}: {
  copy: typeof LEVELS_COPY;
  testIds: LevelsTestIds;
  held: boolean;
  offline: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: { label: string; ordinal: string };
  onDraft: (draft: { label: string; ordinal: string }) => void;
  onConfirm: () => void;
  chrome: LevelsChrome;
}) {
  const { Button, Input, NumberInput, Popover, PopoverTrigger, PopoverContent, Tooltip } = chrome;
  if (!held || offline) {
    return (
      <Shut
        testId={testIds.insert}
        permission={held ? null : AUTHOR_LEVEL_STACK}
        label={copy.levels_insert}
        said={held ? copy.levels_offline : copy.levels_denied_stack}
        variant="primary"
        Tooltip={Tooltip}
      />
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger data-testid={testIds.insert} data-permission={AUTHOR_LEVEL_STACK} data-variant="primary" className="cx-levels-insert">
        {copy.levels_insert}
      </PopoverTrigger>
      <PopoverContent className="cx-levels-insert-form" aria-label={copy.levels_insert}>
        <label className="cx-levels-field">
          <span>{copy.levels_insert_label_field}</span>
          <Input
            value={draft.label}
            data-testid={testIds.insertLabel}
            aria-label={copy.levels_insert_label_field}
            onChange={(event) => onDraft({ ...draft, label: event.target.value })}
          />
        </label>
        <label className="cx-levels-field">
          <span>{copy.levels_insert_ordinal_field}</span>
          <NumberInput
            value={draft.ordinal}
            step={ORDINAL_STEP}
            data-testid={testIds.insertOrdinal}
            aria-label={copy.levels_insert_ordinal_field}
            onChange={(ordinal) => onDraft({ ...draft, ordinal })}
          />
        </label>
        <p className="cx-levels-hint">{copy.levels_insert_hint}</p>
        <Button variant="secondary" data-testid={testIds.insertConfirm} onClick={onConfirm}>
          {copy.levels_insert_confirm}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** One reading of a height, as the inspector lists one: superseded, never erased (R-TO-051). */
function Reading({
  reading,
  testId,
  BasisChip,
  QuantityText,
}: {
  reading: LevelsViewReading;
  testId: string;
  BasisChip: LevelsChrome["BasisChip"];
  QuantityText: LevelsChrome["QuantityText"];
}) {
  return (
    <p
      className="cx-levels-reading"
      data-testid={testId}
      data-basis={reading.basis}
      data-source={reading.sourceKey ?? ""}
      data-metres={reading.canonicalMetres}
      data-superseded={String(reading.superseded)}
    >
      {/* I-25: what was written is kept as it was written, beside what it is worth in metres — and
          each of the four says WHICH it is, because a row of bare figures is not a reading (§3). */}
      <span className="cx-levels-reading-field">
        <span className="cx-levels-reading-label">{LEVELS_COPY.levels_reading_written_label}</span>
        <span className="cx-levels-mono">
          {reading.valueAsWritten} {reading.unitAsWritten}
        </span>
      </span>
      <span className="cx-levels-reading-field">
        <span className="cx-levels-reading-label">{LEVELS_COPY.levels_reading_basis_label}</span>
        <BasisChip basis={reading.basis as QuantityBasis} />
      </span>
      <span className="cx-levels-reading-field">
        <span className="cx-levels-reading-label">{LEVELS_COPY.levels_reading_metres_label}</span>
        <QuantityText value={reading.canonicalMetres} unit={CANONICAL_UNIT.LENGTH} format={FIGURES} />
      </span>
      {reading.sourceKey === null ? null : (
        <span className="cx-levels-reading-field">
          <span className="cx-levels-reading-label">{LEVELS_COPY.levels_reading_source_label}</span>
          <span className="cx-levels-source" data-technical="">
            {reading.sourceKey}
          </span>
        </span>
      )}
      {reading.superseded ? <span className="cx-levels-superseded">{LEVELS_COPY.levels_reading_superseded}</span> : null}
    </p>
  );
}

/**
 * One roll-up cell: the stored lines of one kind on one level, read and never re-derived (I-241). A
 * PARTIAL_DECLARED cell states NO value at all — L-QTY-02's rule about a row, applied to the cell
 * that sums them — and states the code the omission was declared under beside its chip.
 */
function Rollup({
  rollup,
  whole,
  testId,
  CoverageChip,
  EnumLabel,
  QuantityText,
  UnitBadge,
}: {
  rollup: LevelsViewRollup;
  /** False where lines of this kind stand on no level, so this row may be leaving some out (I-433). */
  whole: boolean;
  testId: string;
  CoverageChip: LevelsChrome["CoverageChip"];
  EnumLabel: LevelsChrome["EnumLabel"];
  QuantityText: LevelsChrome["QuantityText"];
  UnitBadge: LevelsChrome["UnitBadge"];
}) {
  const complete = rollup.coverage !== PARTIAL_DECLARED;
  // I-lev-1: the figure at its kind's display precision (exact in `data-value`), and a coverage chip
  // only where a share was in fact measured. A partial roll-up carries no quantity, and the red `0%`
  // it wore was a percentage nobody computed (R-UI-002): its code, in words, says why instead.
  // I-433: and no chip over a roll-up that may be leaving lines out — the figure stands, because it
  // is the sum of the lines this row does hold, but `100%` would claim the floor whole.
  return (
    <span
      className="cx-levels-rollup"
      data-testid={testId}
      data-kind={rollup.kind}
      data-lines={rollup.lines}
      data-coverage={rollup.coverage}
      data-code={rollup.code ?? ""}
      data-whole={String(whole)}
    >
      {/* I-352: the count and the figure each stand in a slot of their own width, right-aligned, so a
          column of roll-ups reads down its figures — `16.828` over `9.761` on the decimal, the unit
          and the chip in one column beside them — and never as a ragged run of text. */}
      <span className="cx-levels-mono cx-levels-count">
        {rollup.lines === 1 ? LEVELS_COPY.levels_rollup_lines_one : fillCopy("levels_rollup_lines", { count: formatUserFigure(String(rollup.lines)) })}
      </span>
      {complete && rollup.value !== null ? <QuantityText value={rollup.value} format={figuresOfKind(rollup.kind)} className="cx-levels-figure" /> : null}
      {complete && rollup.value !== null && isUnit(rollup.unit) ? <UnitBadge unit={rollup.unit} /> : null}
      {complete && whole ? <CoverageChip value={1} /> : null}
      {rollup.code === null ? null : <EnumLabel value={rollup.code} className="cx-levels-enum" />}
    </span>
  );
}

/** The bones that keep this screen's own layout while the route holds it (R-UI-004, §2). */
function LoadingBones({ Skeleton }: { Skeleton: LevelsChrome["Skeleton"] }) {
  return (
    <div className="cx-levels-body">
      <Skeleton style={BONE_RAIL} />
      <Skeleton style={BONE_GRID} />
    </div>
  );
}

const BONE_RAIL = { height: "100%", width: "240px" };
const BONE_GRID = { height: "100%", width: "100%" };
