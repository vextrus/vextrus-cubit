// Which sheet each thing S-Schedules shows stands on, and the order the rail and a sheet's stack
// read in (s-schedules I-248, I-550, I-551; L-CAD-05, R-UI-022).
//
// A schedule is cut out of the drawing's MODEL space (L-CAD-06), but a quantity surveyor reads it on
// the sheet that shows it: F-RCC6-BNBC draws its COLUMN SCHEDULE in model space and prints it on S-11
// through a window. Which sheet one key stands on is core's one reading (`sheetOfKey`,
// `@/core/sheets/frames`) — a key drawn on paper stands on its paper, a key drawn in model space on
// the one sheet whose windows frame it — so this file asks it of the schedule's title, then of the
// caption its view was anchored on, and adds only the join: which table, which deferral and which
// mark family goes on which row of the rail.
//
// Pure: the store's rows, the sheets' words and the record's frames are read by `server.ts` and
// handed here, so the whole composition is judged without a database (B-19).
import { classesDeclaredBy } from "@/core/residue/declared";
import type { ElementType } from "@/core/catalogue/classes";
import { modelSheetOf, sheetOfKey, type RecordFrames, type SheetOfRecord } from "@/core/sheets/frames";
import type { SheetText } from "@/core/notes/grammar";
import type { MemberFamily, ScheduleCell, StoredSchedule, StoredSchedules } from "@/modules/takeoff/partition";
import { familiesViewOf } from "./family-view";
import { MARK_ORDER } from "./order";
import { MODEL_SPACE, type NotesView, type ScheduleTableView, type SheetView } from "./view";

/** What a record says about where its keys stand: its sheets, where each entity was drawn, its windows. */
export type RecordSheets = {
  readonly sheets: readonly SheetOfRecord[];
  readonly spaces: ReadonlyMap<string, string>;
  readonly frames: RecordFrames;
};

/** One sheet of a drawing as the notes lane reads it: its name, its kind of space, its own words. */
export type LayoutWords = { readonly layoutName: string; readonly kind: string; readonly texts: readonly SheetText[] };

/** Everything one drawing's row of the rail is composed from, as the stores answered it. */
export type DrawingReading = {
  readonly drawingId: string;
  /** Every sheet of the drawing's current record, in the record's own order. */
  readonly layouts: readonly LayoutWords[];
  readonly stored: StoredSchedules | null;
  readonly families: readonly MemberFamily[];
  /** The caption each stored view was anchored on, by the view's key — null where none anchors it. */
  readonly anchors: ReadonlyMap<string, string | null>;
  /** The record the schedules were read on, or null where it could not be read: all stands on model space. */
  readonly record: RecordSheets | null;
  /** What one sheet's general notes hold (the notes lane's answer, composed by the caller). */
  readonly notesOf: (layout: LayoutWords) => NotesView;
};

/**
 * The sheet one stored schedule stands on (I-550): the sheet its TITLE stands on where that is a
 * paper sheet, else the sheet the caption its view was anchored on stands on, else model space — where
 * it was drawn, and where no window of a single sheet says otherwise. Null only for a record with no
 * model sheet at all.
 */
export function sheetOfSchedule(schedule: Pick<StoredSchedule, "scheduleKey" | "viewKey">, anchors: ReadonlyMap<string, string | null>, record: RecordSheets): string | null {
  return onPaper([schedule.scheduleKey, anchors.get(schedule.viewKey) ?? null], record) ?? modelSheetOf(record.sheets);
}

/** The first of these keys that stands on a PAPER sheet, by core's one reading — or none. */
function onPaper(keys: readonly (string | null)[], record: RecordSheets): string | null {
  const model = modelSheetOf(record.sheets);
  for (const key of keys) {
    if (key === null) continue;
    const sheet = sheetOfKey(key, record.spaces, record.sheets, record.frames);
    if (sheet !== null && sheet !== model) return sheet;
  }
  return null;
}

/**
 * The order a quantity surveyor takes a structure off in (I-551): the foundations from the bottom
 * up — pile, pile cap, footing, the grade beams that tie them — then the columns and walls that stand
 * on them, then the frame they carry. A class this list does not hold stands after every one it does.
 */
const QS_ORDER: readonly ElementType[] = Object.freeze([
  "pile",
  "pile_cap",
  "footing",
  "tie_beam",
  "column",
  "shear_wall",
  "beam",
  "slab",
  "stair",
  "lintel",
  "brick_wall",
  "opening",
  "surface",
] satisfies ElementType[]);

/** Where a schedule stands in that order: the first class its title names, else after every class. */
function qsRankOf(title: string): number {
  const named = classesDeclaredBy(title)[0];
  const at = named === undefined ? -1 : QS_ORDER.indexOf(named);
  return at < 0 ? QS_ORDER.length : at;
}

/**
 * A sheet's schedules stacked in QS order (I-551) — two of one class keep the store's order. A
 * copy: the list handed in is never moved, and no table's content is touched.
 */
export function schedulesInQsOrder<T extends { readonly title: string }>(tables: readonly T[]): T[] {
  return tables
    .map((table, at) => ({ table, at, rank: qsRankOf(table.title) }))
    .sort((left, right) => left.rank - right.rank || left.at - right.at)
    .map(({ table }) => table);
}

/**
 * Every sheet of one drawing this screen has something to say about (I-248, I-550): a sheet holding
 * a schedule, a schedule view that deferred, a mark family, a figure its words propose or a reading
 * somebody committed. A sheet holding none of those is no row of the rail — its title block is words,
 * but nothing on this screen can be read off them.
 *
 * Paper sheets stand in the record's own order, which is the order the set numbers them; model space
 * stands after them, because it is the draughtsman's workspace and no sheet a reader opens (I-551).
 */
export function sheetsOfReading(reading: DrawingReading): SheetView[] {
  const { record, anchors } = reading;
  const model = reading.layouts.find((layout) => layout.kind === MODEL_SPACE)?.layoutName ?? null;
  const placed = (key: string | null): string | null => (record === null ? model : (onPaper([key], record) ?? model));

  const tables = (reading.stored?.schedules ?? []).map((stored) => ({
    table: tableOf(stored),
    sheet: record === null ? model : sheetOfSchedule(stored, anchors, record),
  }));
  const tableSheet = new Map(tables.map(({ table, sheet }) => [table.scheduleKey, sheet]));
  const deferrals = (reading.stored?.deferrals ?? []).map((deferral) => ({
    view: { viewKey: deferral.viewKey, reason: deferral.reason },
    sheet: tables.find(({ table }) => table.viewKey === deferral.viewKey)?.sheet ?? placed(anchors.get(deferral.viewKey) ?? null),
  }));
  // A family stands with the schedule that named it; a long-section strip family, which no table
  // named, on the sheet its strip's title stands on (I-343).
  const families = reading.families.map((family) => ({ family, sheet: tableSheet.has(family.scheduleKey) ? (tableSheet.get(family.scheduleKey) ?? null) : placed(family.scheduleKey) }));

  const sheets: SheetView[] = [];
  const ordered = [...reading.layouts.filter((layout) => layout.layoutName !== model), ...reading.layouts.filter((layout) => layout.layoutName === model)];
  for (const layout of ordered) {
    const on = <T extends { sheet: string | null }>(held: readonly T[]): T[] => held.filter((one) => one.sheet === layout.layoutName);
    const schedules = schedulesInQsOrder(on(tables).map(({ table }) => table));
    const deferred = on(deferrals).map(({ view }) => view);
    // Marks in the order a reader counts them — RB1, RB2 … RB10 (R-UI-084) — one family per mark
    // however many schedules of this sheet named it, its bands from the ground up (I-506).
    const named = familiesViewOf(on(families).map(({ family }) => family)).sort((left, right) => MARK_ORDER.compare(left.family, right.family));
    const notes = reading.notesOf(layout);
    const holds = schedules.length > 0 || deferred.length > 0 || named.length > 0 || notes.proposals.length > 0 || notes.readings.length > 0;
    if (!holds) continue;
    sheets.push({ drawingId: reading.drawingId, layoutName: layout.layoutName, kind: layout.kind, schedules, deferrals: deferred, families: named, notes });
  }
  return sheets;
}

/**
 * One stored schedule as a table of bands (I-250). The rows are the store's own row indices in
 * ascending order and the cells the store's own column indices — the screen re-reconstructs nothing,
 * and a band the store holds no cell for is a band that was never read.
 *
 * The FIRST band the store holds is the schedule's header — L-CAD-08 anchors a reconstruction on the
 * title and reads the column names off the band beneath it — so it is handed over as the header and
 * the rest as the data. Which band that is, is still the store's answer and not a reading taken here.
 */
export function tableOf(stored: StoredSchedule): ScheduleTableView {
  const bands = new Map<number, ScheduleCell[]>();
  for (const cell of stored.cells) {
    const held = bands.get(cell.rowIndex);
    if (held === undefined) bands.set(cell.rowIndex, [cell]);
    else held.push(cell);
  }
  const ordered = [...bands.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rowIndex, cells]) => ({
      rowIndex,
      cells: [...cells].sort((left, right) => left.columnIndex - right.columnIndex).map((cell) => ({ columnIndex: cell.columnIndex, text: cell.text, sourceKeys: cell.sourceKeys })),
    }));
  return {
    scheduleKey: stored.scheduleKey,
    viewKey: stored.viewKey,
    title: stored.title,
    header: ordered[0],
    rows: ordered.slice(1),
  };
}
