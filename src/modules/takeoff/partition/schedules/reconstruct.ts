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
// from the header until a gap over 3.5× the pitch says the table has ended. A caption the sheet wrote
// on its PAPER, under the window that frames the table, stands in no band of model space at all: the
// view's own texts are read top-down from the first band naming the column of marks, and the paper
// caption stays the title (Interpretation I-320).
//
// A band is not always a row. Where a schedule stacks a mark's whole statement — the section, the
// bars and the ties on three lines of text with the mark written once beside them — the row is
// delimited by the MARK CELLS and the lines between two marks are that mark's (`rowsByMark`), which
// is what "row-cluster by y with BAND-FIRST clustering" asks for: the bands are found first, and the
// rows are made of them.
//
// Pure over the artifact and the stages before it: no store, no clock, no model. The same artifact
// reconstructs the same tables forever, which is what makes the stored partition rebuildable and its
// keys re-derivable (L-REG-04).
import type { ScheduleDeferralReason } from "@/core/db";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { REFUSALS } from "@/core/errors";
import { CELL_JOIN, columnNamesOf, isKeyWordHeader, isMarkFamily, isMarkHeader, isOpeningMark, mtextLines, normaliseNotation, parseSizePair } from "../notation";
import { readNotation } from "../notation/grammar";
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

/** One text of the table's own rows that reaches no column of it: what it says, and where from. */
export type UnplacedText = {
  readonly key: string;
  /** The drawing's own words, verbatim — the same spelling a cell would have carried. */
  readonly text: string;
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
  /**
   * The texts standing in the table's own rows that reach no column of it, in reading order. A
   * revision note out in the margin is a cell of nothing and must not be folded into the nearest
   * column — but the drawing SAID it, and a reading a drawing carries is never discarded in
   * silence (L-QTY-04).
   */
  readonly unplaced: UnplacedText[];
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
  const onPaper = paperCaptionsOf(evidence);

  const tables: ScheduleTable[] = [];
  const deferrals: ScheduleDeferralRow[] = [];
  let examined = 0;

  for (const view of evidence.views) {
    if (view.type !== VIEW_TYPE.SCHEDULE) continue;
    examined += 1;
    const table = tableOf(view, standing.get(view.viewKey) ?? [], onPaper);
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
    const held = byView.get(viewKey) ?? [];
    held.push(...linesOf(placed, entity.attachment));
    byView.set(viewKey, held);
  }
  return byView;
}

/**
 * How far one line of an MTEXT stands beneath the line before it, in multiples of its own character
 * height: the DXF reference's "default (3-on-5) line spacing", five thirds of the height, which the
 * artifact states no factor against (L-CAD-05 carries none) — so the default is what was drawn.
 */
const MTEXT_LINE_PITCH = 5 / 3;

/** Where an inline code of an MTEXT begins: the backslash every one of them opens with. */
const INLINE_CODE = /\\/;

/**
 * The LINES one text stands as (T-MTEXT-CODES). A text carrying an MTEXT inline code is a block of
 * paragraphs: each is a line of its own, its codes taken away (`mtextLines`, B-17), standing one line
 * pitch beneath the one before it at the block's own insertion x — so a title and the header a
 * draughtsman typed into ONE block under it are two bands of the page, as they are two lines of the
 * sheet, and the header is read where it is drawn (F-RCC6-BNBC S-06's `639`). Every line keeps the
 * block's key: the cells read off it cite the entity they were read from (L-CAD-03).
 *
 * A text carrying no code is one line, itself, exactly as it was placed — no DXF type is asked, only
 * what the text says (L-CAD-08: the words decide everything). A blank paragraph is no line, and still
 * moves the next one down.
 *
 * The block stands where its ATTACHMENT puts it (s-schedules I-504; L-CAD-05 carries it at v3): a
 * block attached at its top hangs from its insertion, as every block this reader met before did; one
 * attached at its middle is centred on it, and one attached at its foot stands on it. An architect's
 * schedule centres each cell's MTEXT in its cell, so a size wrapped over two lines (`4'-0"` over
 * `X 7'-0"`) stands half a line pitch either side of the row it belongs to — inside the row's band —
 * where hanging it from its insertion dropped its second line into a band of its own.
 */
function linesOf(placed: Placed, attachment: number | undefined): Placed[] {
  if (!INLINE_CODE.test(placed.text)) return [placed];
  const pitch = placed.height * MTEXT_LINE_PITCH;
  const lines = mtextLines(placed.text);
  const lift = (lines.length - 1) * pitch * ATTACHMENT_LIFT[rowOfAttachment(attachment)];
  return lines.flatMap((line, at) => (line.trim() === "" ? [] : [{ ...placed, text: line, y: placed.y + lift - at * pitch }]));
}

/** An MTEXT's attachment row (DXF group 71, 1–9 read row by row): top, middle or bottom. */
type AttachmentRow = "top" | "middle" | "bottom";

/** How far a block's first line stands above its insertion, in multiples of the block's own height
 * below its first line: none for a block hanging from its top, half for a centred one, all of it for
 * one standing on its foot. */
const ATTACHMENT_LIFT: Readonly<Record<AttachmentRow, number>> = Object.freeze({ top: 0, middle: 0.5, bottom: 1 });

/** The row an attachment point stands in. A text stating none — a v2 artifact, a plain TEXT — hangs
 * from its insertion, which is how every block was read before the attachment was carried. */
function rowOfAttachment(attachment: number | undefined): AttachmentRow {
  if (attachment === undefined || attachment <= 3) return "top";
  return attachment <= 6 ? "middle" : "bottom";
}

/**
 * The SCHEDULE views' caption keys that are texts of a PAPER layout (Interpretation I-320): the
 * windows a sheet titles on its own paper, beneath the frame, with nothing in model space saying so
 * (L-CAD-05, I-290). Only a schedule's anchors are looked up, so the set is as small as the question.
 */
function paperCaptionsOf(evidence: ScheduleEvidence): ReadonlySet<string> {
  const onPaper = new Set<string>();
  // An artifact naming no model layout says of no text that it stands anywhere ELSE, so none is a
  // paper caption — the reading every schedule was read by before stands for it unchanged.
  const modelSpace = (evidence.graph.layouts ?? []).find((layout) => layout.kind === "model")?.name;
  if (modelSpace === undefined) return onPaper;
  const anchors = new Set(evidence.views.flatMap((view) => (view.type === VIEW_TYPE.SCHEDULE && view.anchorKey !== null ? [view.anchorKey] : [])));
  for (const entity of evidence.graph.entities) {
    if (anchors.has(entity.key) && entity.space !== modelSpace && (entity.text ?? "").trim() !== "") onPaper.add(entity.key);
  }
  return onPaper;
}

/**
 * The table one schedule view yielded, or null where its texts amount to none: no caption to anchor
 * it on, no two bands to read a pitch from, or no band naming the column of marks. Half a table —
 * rows with no header to say what their columns mean — is worse than none (L-QTY-04).
 *
 * The caption anchors the table in one of two places (I-320). A caption drawn in MODEL space stands
 * over its table, and the table is what stands beneath it. A caption the sheet wrote on its PAPER,
 * under the window that frames the table, stands in no model-space band at all — the partition
 * assigns no paper text to a view (L-CAD-06) — so it anchors nothing by position: the view's own
 * model texts are the whole of what the window shows, read top-down from the first band that names
 * the column of marks, and the paper caption stays what it is, the table's title. F-RCC6-BNBC's
 * PILE SCHEDULE and PILE CAP SCHEDULE are titled that way, beneath their windows.
 */
function tableOf(view: PartitionedView, standing: readonly Placed[], onPaper: ReadonlySet<string>): ScheduleTable | null {
  const anchor = standing.find((text) => text.key === view.anchorKey);
  if (anchor !== undefined) {
    // A schedule reads DOWN from its title, so the table is what stands beneath the caption.
    return tableUnder(view, anchor.key, bandsOf(standing.filter((text) => text.key !== anchor.key && text.y < anchor.y)));
  }
  if (view.anchorKey === null || !onPaper.has(view.anchorKey)) return null;
  return tableUnder(view, view.anchorKey, bandsOf(standing));
}

/**
 * The table the bands of one view hold, keyed by the caption that titles it: the header is the FIRST
 * band naming the column of marks — so a note a draughtsman writes above the table is no row of it —
 * and the rows run down from it until the gap says the table has ended.
 */
function tableUnder(view: PartitionedView, scheduleKey: string, bands: readonly Band[]): ScheduleTable | null {
  const header = bands.findIndex((band) => headsColumns(band));
  if (header < 0) return null;

  const pitch = pitchBeneath(bands, header);
  if (pitch === null) return null;

  const rows = unruledRows(bands, header, pitch) ?? rowsFrom(bands, header, pitch);
  const columns = columnsOf(rows[0] as Band);
  const reach = columnReachOf(columns);
  const read = rowsByMark(rows, columns, reach).map((band, rowIndex) => cellsOf(band, columns, reach, rowIndex));

  return {
    viewKey: view.viewKey,
    scheduleKey,
    title: normaliseNotation(view.caption).trim(),
    pitch,
    columns,
    cells: read.flatMap((one) => one.cells),
    unplaced: read.flatMap((one) => one.unplaced),
  };
}

/**
 * Does this band HEAD the table's columns — hold a cell naming the column of marks, and state its
 * columns (s-schedules I-503)? A band naming the key column by MARK heads it, alone on its line
 * or not, as it always has. A band whose one text names it by a KEY WORD alone and names one column —
 * `DOOR`, `WINDOW & VENTILATOR`, `ROOM FINISH SCHEDULE` — titles a group of sub-tables or the table
 * itself: the same words head the key column only where the band states another column beside them
 * (`SL. | MAIN DOOR | SIZE (W x H) | QUANTITY`). Taken as the header, such a title read every cell of
 * the schedule into its one column.
 */
function headsColumns(band: Band): boolean {
  if (!band.texts.some((text) => isMarkHeader(text.text))) return false;
  const [only] = band.texts;
  return !(band.texts.length === 1 && only !== undefined && isKeyWordHeader(only.text) && columnNamesOf(only.text).length < 2);
}

/**
 * Does this band HEAD something — a table, a sub-table or a group of them? It holds a text naming the
 * key column, whether or not it states columns beside it (`headsColumns`). Such a band is a row of its
 * own and never a line of a mark's row (`rowsByMark`): the sub-tables an opening schedule is typed in
 * each repeat a header half a row above their first mark, and claimed by it they read `FIRE DOOR+FD-1`
 * as the mark (I-503).
 */
function headsSomething(band: Band): boolean {
  return band.texts.some((text) => isMarkHeader(text.text));
}

/**
 * Does this cell name a member of the key column? A mark of the shape a member mark takes (`C1`,
 * `D-2`), or an OPENING the roster names by word (`LD`, s-schedules I-505). One reading for the
 * rows a stacked schedule is made of and the families the registry folds (B-17).
 */
export function isMarkCell(text: string): boolean {
  return isMarkFamily(text) || isOpeningMark(text);
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
 * The pitch of the table the header stands over: the step from that header to the band beneath it,
 * which is the spacing the schedule stacks its rows at, declared where the table begins. Read before
 * the rows are chosen, because the 3.5× stop cannot be applied without it (L-CAD-08).
 *
 * A statistic taken over every band of the view instead — the median gap on the page — lets whatever
 * stands UNDER the table teach the reconstruction a spacing the table never used: general notes
 * stacked wider than the rows outnumber the rows, the stop then never fires, and notes nobody drew as
 * rows are stored as rows carrying cited keys (L-QTY-04). A header with nothing beneath it heads no
 * table at all.
 */
function pitchBeneath(bands: readonly Band[], header: number): number | null {
  const first = bands[header + 1];
  if (first === undefined) return null;
  const pitch = (bands[header] as Band).y - first.y;
  return pitch > 0 ? pitch : null;
}

/**
 * The columns of the table, read off its header band: its texts clustered across the page, each
 * column standing at the MEDIAN insertion of the texts that made it.
 *
 * Bands cluster with a tolerance because a draughtsman's hand moves a cell off its line; columns owe
 * the same allowance for the same reason. Deduped by EXACT insertion x, a header text nudged four
 * tenths of a millimetre starts a column of its own, and every cell beneath it is then split between
 * two columns that are one column. The tolerance is the same one the bands use — the taller of the
 * two texts' own heights, which is scale-free where a distance in drawing units would not be — and
 * the median keeps one nudged text from moving the column off where its texts stand (L-QTY-04).
 */
function columnsOf(header: Band): number[] {
  const clusters: Placed[][] = [];
  for (const text of [...header.texts].sort((left, right) => left.x - right.x)) {
    const held = clusters[clusters.length - 1];
    const last = held?.[held.length - 1];
    if (held !== undefined && last !== undefined && text.x - last.x <= Math.max(last.height, text.height)) held.push(text);
    else clusters.push([text]);
  }
  return clusters.map((cluster) => medianOf(cluster.map((text) => text.x)));
}

/**
 * The ROWS of the table, which are not always its bands (L-CAD-08's "band-first clustering"). A
 * schedule that states a column's whole band in one cell stacks the statement: the section on one
 * line of text, the bars on the next, the ties on the third, with the mark written once beside them
 * (F-RCC6-BNBC S-11). Read band by band that is three rows, two of which name no member at all: the
 * mark's row then carries the ties alone as its section, every variant of every column of the
 * schedule reads as sectionless, and no column line can be published from a drawing that states
 * every column it has.
 *
 * So a row is delimited by the MARK CELLS: a band that names no member belongs to the row of the
 * mark it stands nearest, and the texts it carries are that row's — joined per column, in the order
 * the page is read, by the same sign two texts of one cell are joined with (`cellsOf`, AC-2), each
 * cell citing every text it was read from (L-CAD-03).
 *
 * How near is near enough is the table's own statement, read the way the COLUMNS' reach is: half the
 * closest its mark cells ever stand to each other, which is where one row stops being the nearest.
 * S-11's marks stand 2,600 apart and its stacked lines 400 and 800 above their own mark, so they
 * join it; the three general notes beneath the last row stand 2,200 and further off, so they do not
 * and stay rows of their own — which is what keeps `ALL COLUMNS f'c = 3500 psi` out of C7's section.
 *
 * A table with FEWER THAN TWO mark cells states no row spacing at all, and a table no band of which
 * names a member states no rows: both are read band for band, as they were before, because there is
 * nothing in them to read a row's extent from and a reading nobody can check is a guess (L-QTY-01).
 */
function rowsByMark(rows: readonly Band[], columns: readonly number[], reach: number): Band[] {
  const head = rows[0];
  if (head === undefined) return [...rows];
  const body = rows.slice(1);
  const mark = cellsOf(head, columns, reach, 0).cells.find((cell) => isMarkHeader(cell.text));
  if (mark === undefined) return [...rows];

  const marked = body.map((band) => {
    const cell = cellsOf(band, columns, reach, 0).cells.find((one) => one.columnIndex === mark.columnIndex);
    return cell !== undefined && isMarkCell(cell.text);
  });
  const claim = rowReachOf(body, marked);
  if (claim === null) return [...rows];

  // A band that heads a sub-table or a group is a row of its own, however near a mark it stands.
  const owners = body.map((band, index) => (marked[index] === true || headsSomething(band) ? index : nearestMark(body, marked, band, claim) ?? index));
  const held = new Map<number, Placed[]>();
  const order: number[] = [];
  for (const [index, band] of body.entries()) {
    const owner = owners[index] as number;
    const kept = held.get(owner);
    if (kept === undefined) {
      held.set(owner, [...band.texts]);
      order.push(owner);
      continue;
    }
    kept.push(...band.texts);
  }
  // A row stands where its own mark stands; a band no mark claimed stands where it was drawn.
  return [head, ...order.map((owner) => ({ y: (body[owner] as Band).y, texts: held.get(owner) as Placed[] }))];
}

/**
 * How far off a mark a band may stand and still be a line of that mark's row: half the closest the
 * table's own mark cells ever stand to each other (`NEAREST_SHARE`), or null where the table has
 * fewer than two of them to measure with.
 */
function rowReachOf(body: readonly Band[], marked: readonly boolean[]): number | null {
  const ys = body.filter((_band, index) => marked[index] === true).map((band) => band.y);
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < ys.length; index += 1) closest = Math.min(closest, (ys[index - 1] as number) - (ys[index] as number));
  return Number.isFinite(closest) && closest > 0 ? closest * NEAREST_SHARE : null;
}

/** Which mark's row this band is a line of: the nearest within reach, ties to the one higher up the
 * page — or none, which leaves the band a row of its own. */
function nearestMark(body: readonly Band[], marked: readonly boolean[], band: Band, claim: number): number | null {
  let held: number | null = null;
  for (const [index, one] of body.entries()) {
    if (marked[index] !== true) continue;
    const gap = Math.abs(one.y - band.y);
    if (gap > claim) continue;
    if (held === null || gap < Math.abs((body[held] as Band).y - band.y)) held = index;
  }
  return held;
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
 * The rows of an UN-RULED table whose header the draughtsman typed as ONE text (T-SCHED-NORULES,
 * Interpretation I-330) — F-RCC6-BNBC's S-06 PILE CAP SCHEDULE, whose `MARK  SIZE  DEPTH  PILES
 * BOTTOM MESH  TOP MESH` is one line of one MTEXT standing over six columns of TEXTs — or null where
 * the table is not one, and the header band's own texts give the columns as they always did.
 *
 * Such a header names its columns and says nothing about where they stand: its words share one
 * insertion. So the columns are read where the ROWS put them — the x's the texts of the rows beneath
 * align at — and named in the header's own word order. The reading is taken only where the drawing
 * corroborates it, and otherwise is not taken at all (L-QTY-01: never a guess):
 *
 *   · the header band is that one text, and it names two columns or more (`columnNamesOf`);
 *   · a ROW of such a table states two cells or more — a band of one text aligns with nothing, which
 *     is what a note beneath the table is (`COUNTS ARE TAKEN FROM THE LAYOUT ABOVE`), so the first
 *     band of fewer ends the rows, exactly as the 3.5× gap does;
 *   · the rows' texts stand at exactly as many columns as the header names; and
 *   · every row states a cell in the column the header names the MARK — a table whose marks stand
 *     somewhere the header does not put them is a table whose columns this reading has not found
 *     (F-RCC6-BNBC S-25's lintel schedule, whose rows are block attributes this reader cannot reach,
 *     keeps the reading it always had).
 *
 * What it answers is the header as a band of NAMED texts standing at the columns — one per name, each
 * citing the header text it was read from — followed by the rows: the table every later step already
 * reads (`columnsOf`, `rowsByMark`, `cellsOf`).
 */
function unruledRows(bands: readonly Band[], header: number, pitch: number): Band[] | null {
  const head = bands[header] as Band;
  const said = head.texts.length === 1 ? head.texts[0] : undefined;
  if (said === undefined) return null;
  const names = columnNamesOf(said.text);
  if (names.length < 2) return null;
  const mark = names.findIndex((name) => isMarkHeader(name));
  if (mark < 0) return null;

  const body: Band[] = [];
  for (let index = header + 1; index < bands.length; index += 1) {
    const band = bands[index] as Band;
    if ((bands[index - 1] as Band).y - band.y > pitch * ROW_GAP_STOP || band.texts.length < 2) break;
    body.push(band);
  }
  if (body.length === 0) return null;

  const columns = columnsOf({ y: head.y, texts: body.flatMap((band) => band.texts) });
  if (columns.length !== names.length) return null;
  const reach = columnReachOf(columns);
  if (!body.every((band) => band.texts.some((text) => columnNearest(columns, text.x, reach) === mark))) return null;

  const named: Band = { y: head.y, texts: names.map((name, index) => ({ ...said, text: name, x: columns[index] as number })) };
  return [named, ...body];
}

/**
 * One band's cells, one per column it says anything in, and the texts of that band that reached no
 * column at all. A text belongs to the column its insertion stands nearest, and two texts in one cell
 * are ONE cell: they are joined in the order they are read down the page, and the cell cites both of
 * the texts it was read from (AC-2, L-CAD-03).
 */
function cellsOf(band: Band, columns: readonly number[], reach: number, rowIndex: number): { cells: ScheduleCell[]; unplaced: UnplacedText[] } {
  const byColumn = new Map<number, Placed[]>();
  const unplaced: UnplacedText[] = [];
  for (const text of band.texts) {
    const columnIndex = columnNearest(columns, text.x, reach);
    // A revision note out in the margin stands level with a row and in no column of it: folding it
    // into the nearest one would rewrite that cell — and on the mark column it would cost the row the
    // member it names (L-CAD-08). It is answered instead of dropped, so what the drawing said there
    // is still a thing a reader can go and look at (L-QTY-04).
    if (columnIndex === null) {
      unplaced.push({ key: text.key, text: text.text });
      continue;
    }
    const held = byColumn.get(columnIndex);
    if (held === undefined) byColumn.set(columnIndex, [text]);
    else held.push(text);
  }
  const cells = [...byColumn.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([columnIndex, texts]) => {
      const said = runOn(texts);
      return { rowIndex, columnIndex, text: said.map((one) => one.text).join(CELL_JOIN), sourceKeys: said.map((one) => one.key) };
    });
  return { cells, unplaced };
}

/**
 * The texts of one cell, with the LINES of one text run on (s-schedules I-504). Two texts in one
 * cell are two statements, joined by the notation's sign (AC-2); two lines of ONE text are one
 * statement the draughtsman wrapped to the cell's width — `4'-0"` over `X 7'-0"` is the size
 * `4'-0" X 7'-0"` — so they are read as the words they are, a space between, and the cell cites the
 * text once (L-CAD-03).
 *
 * Unless its lines are statements of their own, stacked: a structural MTEXT putting `4-20Ø` over
 * `2-16Ø` in one rebar cell says two groups of bars, exactly as two texts stacked there would, and is
 * joined by the sign as they are (AC-2) — run on with a space it read as nothing at all. Lines are
 * STACKED where each one alone is a statement of the notation and together they are not one: a
 * wrapped size's `X 7'-0"` reads as a length by itself, but run on the lines read as the size, so they
 * are one statement wrapped; a line of prose (a room's finish) reads as nothing by itself, so its text
 * was wrapped to the cell.
 */
function runOn(texts: readonly Placed[]): { key: string; text: string }[] {
  const said: { key: string; lines: string[] }[] = [];
  for (const text of texts) {
    const last = said[said.length - 1];
    if (last !== undefined && last.key === text.key) last.lines.push(text.text);
    else said.push({ key: text.key, lines: [text.text] });
  }
  return said.map(({ key, lines }) => ({ key, text: lines.join(stacked(lines) ? CELL_JOIN : " ") }));
}

/** Are these lines of one text statements stacked, rather than one statement wrapped? */
function stacked(lines: readonly string[]): boolean {
  return lines.length > 1 && lines.every(isStatement) && parseSizePair(lines.join(" ")) === null;
}

/** Does this line say something by itself — a form of the notation, or a section as a pair? */
function isStatement(line: string): boolean {
  return readNotation(line).ok || parseSizePair(line) !== null;
}

/**
 * How far off a thing's own insertion a text may stand and still belong to it — across the page to a
 * column, down it to a row — as a share of the closest two of them ever stand to each other: a
 * content-scaled share, never a constant in drawing units (L-MEA-01). Half, because half the closest
 * spacing is where one of them stops being the nearest, and a text further out than that stands
 * between them or beyond them. One number for one reading, whichever way the page is read (B-17).
 */
const NEAREST_SHARE = 0.5;

/** That reach for one table's columns. A table of one column has nothing to stand between: it reaches
 * across its band, since a text there is nearer no other column of a table that has no other. */
function columnReachOf(columns: readonly number[]): number {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < columns.length; index += 1) closest = Math.min(closest, (columns[index] as number) - (columns[index - 1] as number));
  return closest * NEAREST_SHARE;
}

/** Which column a text stands in: the nearest one within reach, ties going to the leftmost — or none. */
function columnNearest(columns: readonly number[], x: number, reach: number): number | null {
  let held: number | null = null;
  for (const [index, column] of columns.entries()) {
    if (Math.abs(column - x) > reach) continue;
    if (held === null || Math.abs(column - x) < Math.abs((columns[held] as number) - x)) held = index;
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
