// L-CAD-08's gridless reconstruction: "Schedule tables reconstruct without gridlines: anchor on the
// title, row-cluster by y" — the fourth stage of R-TO-030's stored partition.
//
// A table is read off the TEXTS a drawing carries and nothing else. No gridline, no layer name and
// no DXF type reaches this file: a schedule drawn with its rules erased and a schedule drawn with
// them are the same table, so the linework decides nothing and the words decide everything.
//
// The reading, in order: the view's caption anchors the table and names it; the texts beneath the
// caption cluster into bands by y, a text joining the band whose centre stands within one text
// height of its own insertion; the header is the FIRST band beneath the caption holding a cell that
// names the column of marks, so the notes a draughtsman writes above the table are no rows of it;
// the columns are that header's own insertion x's, ascending (riskNotes (1)); and the rows run down
// from the header until a gap over 3.5× the pitch says the table has ended.
//
// Pure over the artifact and the stages before it: no store, no clock, no model. The same artifact
// reconstructs the same tables forever, which is what makes the stored partition rebuildable and its
// keys re-derivable (L-REG-04).
import type { ScheduleDeferralReason } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { REFUSALS } from "@/core/errors";
import { CELL_JOIN, isMarkHeader, normaliseNotation } from "../notation";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";

/** One cell of a reconstructed table: where it stands, what it says, and what it was read from. */
export type ScheduleCell = {
  readonly rowIndex: number;
  readonly columnIndex: number;
  /** The drawing's own words, verbatim — two texts of one cell joined by the notation's own sign. */
  readonly text: string;
  /** The texts the cell was read from, in the order they are read (L-CAD-03). */
  readonly sourceKeys: string[];
};

/** One table a SCHEDULE view yielded, anchored on the caption that titles it. */
export type ScheduleTable = {
  readonly viewKey: string;
  /** The caption's own source key: the anchor the whole table is traced back to. */
  readonly scheduleKey: string;
  readonly title: string;
  /** The spacing its bands stand at — what the 3.5× stop between rows is measured in. */
  readonly pitch: number;
  /** The header texts' insertion x, ascending (riskNotes (1)). */
  readonly columns: number[];
  readonly cells: ScheduleCell[];
};

/** A schedule view that yielded no table, and the closed reason it did (riskNotes (2)). */
export type ScheduleDeferralRow = {
  readonly viewKey: string;
  readonly reason: ScheduleDeferralReason;
};

/** What one artifact's schedule reading found: how many views it examined, and what stood in them. */
export type ReconstructedSchedules = {
  readonly views: number;
  readonly tables: ScheduleTable[];
  readonly deferrals: ScheduleDeferralRow[];
};

/** What the stage is handed: the artifact, and what the stages before it derived from it. */
export type ScheduleEvidence = {
  readonly graph: EntityGraph;
  readonly views: readonly PartitionedView[];
  /** Entity source key → view key, as the views stage assigned them (L-CAD-06). */
  readonly assignments: ReadonlyMap<string, string>;
};

/**
 * How large a gap between two bands ends the table, in multiples of its own pitch (L-CAD-08). A
 * schedule stacks its rows at one spacing and then leaves the page: the note a draughtsman writes
 * under the table stands further off than any row of it ever does.
 */
const ROW_GAP_STOP = 3.5;

/** One text of the drawing as this reading sees one: what it says, and where it was drawn. */
type Placed = {
  readonly key: string;
  readonly text: string;
  /** The insertion point, which is what a column's position IS (riskNotes (1)). */
  readonly x: number;
  readonly y: number;
  readonly height: number;
};

/** One band of the drawing: the y its texts stand at, and the texts standing there, in reading order. */
type Band = { y: number; readonly texts: Placed[] };

/**
 * The schedules of one artifact (L-CAD-08). Every SCHEDULE view is examined; each one either yields
 * the table its caption anchors, or one deferral saying no table could be reconstructed from it. A
 * view yields a table or a deferral, never both and never neither.
 */
export function reconstructSchedules(evidence: ScheduleEvidence): ReconstructedSchedules {
  const standing = textsByView(evidence);

  const tables: ScheduleTable[] = [];
  const deferrals: ScheduleDeferralRow[] = [];
  let examined = 0;

  for (const view of evidence.views) {
    if (view.type !== VIEW_TYPE.SCHEDULE) continue;
    examined += 1;
    const table = tableOf(view, standing.get(view.viewKey) ?? []);
    if (table === null) {
      deferrals.push({ viewKey: view.viewKey, reason: REFUSALS.SCHEDULE_NONE_RECONSTRUCTED.code });
      continue;
    }
    tables.push(table);
  }

  return { views: examined, tables, deferrals };
}

/**
 * Every placed text of the artifact, by the view it was assigned to. The assignment is what puts an
 * entity in model space at all: L-CAD-06 partitions model space, so a paper layout's furniture is
 * assigned to nothing and is part of no schedule.
 */
function textsByView(evidence: ScheduleEvidence): Map<string, Placed[]> {
  const byView = new Map<string, Placed[]>();
  for (const entity of evidence.graph.entities) {
    const viewKey = evidence.assignments.get(entity.key);
    if (viewKey === undefined) continue;
    const said = entity.text ?? "";
    const at = (entity.points ?? [])[0];
    // A text with nothing to say, or with nowhere it stands, is in no band and no column.
    if (said.trim() === "" || at === undefined) continue;
    const placed: Placed = { key: entity.key, text: said, x: at[0] ?? 0, y: at[1] ?? 0, height: entity.height ?? 0 };
    const held = byView.get(viewKey);
    if (held === undefined) byView.set(viewKey, [placed]);
    else held.push(placed);
  }
  return byView;
}

/**
 * The table one schedule view yielded, or null where its texts amount to none: no caption to anchor
 * it on, no two bands to read a pitch from, or no band naming the column of marks. Half a table —
 * rows with no header to say what their columns mean — is worse than none (L-QTY-04).
 */
function tableOf(view: PartitionedView, standing: readonly Placed[]): ScheduleTable | null {
  const anchor = standing.find((text) => text.key === view.anchorKey);
  if (anchor === undefined) return null;

  // A schedule reads DOWN from its title, so the table is what stands beneath the caption.
  const bands = bandsOf(standing.filter((text) => text.key !== anchor.key && text.y < anchor.y));
  const pitch = pitchOf(bands);
  if (pitch === null) return null;

  const header = bands.findIndex((band) => band.texts.some((text) => isMarkHeader(text.text)));
  if (header < 0) return null;

  const rows = rowsFrom(bands, header, pitch);
  const columns = [...new Set((rows[0] as Band).texts.map((text) => text.x))].sort((left, right) => left - right);

  return {
    viewKey: view.viewKey,
    scheduleKey: anchor.key,
    title: normaliseNotation(view.caption).trim(),
    pitch,
    columns,
    cells: rows.flatMap((band, rowIndex) => cellsOf(band, columns, rowIndex)),
  };
}

/**
 * The bands of one view's texts, from the top of the page down. A text joins the band whose centre
 * stands within its own height of its insertion y — one text height, because that is how far a
 * draughtsman's own hand moves a cell off the line it belongs to and no further (riskNotes (4)).
 *
 * A band's centre is the MEDIAN of what stands in it, so one text nudged off the line moves the
 * band's own y not at all: a row is where most of its cells are.
 */
function bandsOf(texts: readonly Placed[]): Band[] {
  const bands: Band[] = [];
  for (const text of [...texts].sort(inReadingOrder)) {
    const joined = bandNearest(bands, text);
    if (joined === null) {
      bands.push({ y: text.y, texts: [text] });
      continue;
    }
    joined.texts.push(text);
    joined.y = medianOf(joined.texts.map((one) => one.y));
  }
  return bands.sort((left, right) => right.y - left.y);
}

/** The band this text belongs to — the nearest one within reach — or null where it starts its own. */
function bandNearest(bands: readonly Band[], text: Placed): Band | null {
  let held: Band | null = null;
  for (const band of bands) {
    const gap = Math.abs(band.y - text.y);
    if (gap > text.height) continue;
    if (held === null || gap < Math.abs(held.y - text.y)) held = band;
  }
  return held;
}

/**
 * The pitch the bands stand at: the median gap between one band and the next. The median rather than
 * the mean, because the gaps a schedule really carries are its own row spacing repeated, plus the
 * larger gaps to whatever stands off the table — and a mean would be dragged by exactly those.
 */
function pitchOf(bands: readonly Band[]): number | null {
  const gaps: number[] = [];
  for (let index = 1; index < bands.length; index += 1) gaps.push((bands[index - 1] as Band).y - (bands[index] as Band).y);
  if (gaps.length === 0) return null;
  const pitch = medianOf(gaps);
  return pitch > 0 ? pitch : null;
}

/** The rows of the table: the header, and every band beneath it until the gap says the table ended. */
function rowsFrom(bands: readonly Band[], header: number, pitch: number): Band[] {
  const rows: Band[] = [bands[header] as Band];
  for (let index = header + 1; index < bands.length; index += 1) {
    if ((bands[index - 1] as Band).y - (bands[index] as Band).y > pitch * ROW_GAP_STOP) break;
    rows.push(bands[index] as Band);
  }
  return rows;
}

/**
 * One band's cells, one per column it says anything in. A text belongs to the column its insertion
 * stands nearest, and two texts in one cell are ONE cell: they are joined in the order they are read
 * down the page, and the cell cites both of the texts it was read from (AC-2, L-CAD-03).
 */
function cellsOf(band: Band, columns: readonly number[], rowIndex: number): ScheduleCell[] {
  const byColumn = new Map<number, Placed[]>();
  for (const text of band.texts) {
    const columnIndex = columnNearest(columns, text.x);
    const held = byColumn.get(columnIndex);
    if (held === undefined) byColumn.set(columnIndex, [text]);
    else held.push(text);
  }
  return [...byColumn.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([columnIndex, texts]) => ({
      rowIndex,
      columnIndex,
      text: texts.map((one) => one.text).join(CELL_JOIN),
      sourceKeys: texts.map((one) => one.key),
    }));
}

/** Which column a text stands in: the nearest one, ties going to the leftmost. */
function columnNearest(columns: readonly number[], x: number): number {
  let held = 0;
  for (const [index, column] of columns.entries()) {
    if (Math.abs(column - x) < Math.abs((columns[held] as number) - x)) held = index;
  }
  return held;
}

/** The order a page is read in: down first, then across, then by the key the drawing gave. */
function inReadingOrder(left: Placed, right: Placed): number {
  if (left.y !== right.y) return right.y - left.y;
  if (left.x !== right.x) return left.x - right.x;
  return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
}

/** The middle of a set of numbers, or the mean of its two middles where it has an even count. */
function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}
