// Which cells of a reconstructed schedule the deterministic path leaves CONTESTED, and what the
// notation grammar could read each of them as (R-TO-031, L-CAD-08, L-AI-03).
//
// CODE finds every candidate; a model only ever SELECTS one of them. That is the whole shape of the
// question this directory asks: L-AI-03 prefers the deterministic reading, so a cell the column's
// own header and `readNotation` already settle is never put to a model, and a cell that IS put to
// one is offered nothing but the readings the grammar itself found in the cell's own words. A model
// therefore cannot invent a section, a bar or a band the drawing does not carry — it can only say
// which of the drawing's own readings this cell states, or that it states none.
//
// Pure and total over the stored table: no store, no clock, no model, no I/O. The same table yields
// the same contested rows and the same candidate ids forever, which is what makes the request a fact
// about the drawing rather than about the run (L-AI-01 replays deterministically).
//
// Nothing here edits the reconstruction or the member-type registry beside it: `registerMemberTypes`
// still reads what it always read. A candidate is an offer, never a reading that has been taken.
import { CELL_JOIN, cellParts, isMarkHeader, parseFloorZone, parseSizePair, parseZonedSpacing, rebarZoneOfHeader } from "../../notation";
import { readNotation, type NotationKind } from "../../notation/grammar";
import type { ScheduleCell, ScheduleTable } from "../reconstruct";
import { CANDIDATE_CAP, CELL_ATTRIBUTE_MEANS, CONTESTED_CELL_CAP, type CellAttribute } from "./law";

/** One header column of a table: where it stands, and the word the header band wrote over it. */
export type ScheduleColumn = { readonly index: number; readonly header: string };

/**
 * One reading the grammar found in a cell's own words: the span it read, the attribute that span
 * would state, the sentence that attribute means, and the texts the span was read from.
 *
 * `sourceKeys` is always a subset of the cell's own keys — a candidate cites the words it was read
 * from and never the row's, so a chosen candidate's citation resolves against the artifact whatever
 * else the row carries (L-CAD-03, L-AI-02).
 */
export type CellCandidate = {
  readonly id: string;
  readonly attribute: CellAttribute;
  readonly means: string;
  readonly text: string;
  readonly sourceKeys: readonly string[];
};

/** One contested cell, as the question is asked about it. */
export type ContestedCell = {
  readonly columnIndex: number;
  readonly text: string;
  /** The header of the column it stands under — blank where the schedule headed it with nothing. */
  readonly header: string;
  readonly candidates: readonly CellCandidate[];
};

/**
 * One row of one table, as the state a question is asked over: the table's title and columns, the
 * row's own texts and the keys they were read from, and the cells the deterministic path left
 * contested. The field names are the paths the question's instructions reference (`cells.2.text`),
 * so the state a model is shown and the words it is shown them under are the same thing.
 */
export type CellReadingState = {
  readonly title: string;
  readonly columns: readonly ScheduleColumn[];
  readonly row: { readonly index: number; readonly texts: readonly string[]; readonly sourceKeys: readonly string[] };
  /** Keyed by the column index as a string, so an instruction can name `cells.2.candidates`. */
  readonly cells: Readonly<Record<string, ContestedCell>>;
};

/** What a schedule's header says about the column beneath it, in the grammar's own vocabulary. */
type HeaderRole = "mark" | "zone" | "band" | "silent";

/** The header band of a table, in column order — row 0 is the header the columns were taken from. */
export function columnsOfTable(table: ScheduleTable): ScheduleColumn[] {
  return table.cells
    .filter((cell) => cell.rowIndex === 0)
    .sort((left, right) => left.columnIndex - right.columnIndex)
    .map((cell) => ({ index: cell.columnIndex, header: cell.text }));
}

/**
 * Every reading the grammar can make of ONE cell, in the order it found them (R-TO-031).
 *
 * Two passes. SPANS first: the cell's whole text, and — where the draughtsman wrote two texts into
 * one cell, which `reconstruct` joined with the notation's own sign — each part on its own, each
 * carrying the one source key it was read from. READINGS second: every span is read by
 * `spanAttributes` — the grammar's own kind mapped, totally, onto the attribute roster, and the
 * section a pair of sides states — and a kind that states nothing about a member (a grade, a cover,
 * a span fraction, a cross-reference) offers nothing. A cell no span of which states anything offers
 * NO candidate at all, and `contestedRowsOf` then never asks about it: a question whose only answer
 * is the no-match outcome is a question nobody can answer.
 */
export function cellReadingCandidates(cell: ScheduleCell): CellCandidate[] {
  const found: { attribute: CellAttribute; text: string; sourceKeys: readonly string[] }[] = [];
  for (const span of spansOf(cell)) {
    for (const attribute of spanAttributes(span.text)) {
      found.push({ attribute, text: span.text, sourceKeys: span.sourceKeys });
    }
  }

  // One reading is offered once. The whole text and its only part are the same words, and a cell
  // offered the same span twice would put a model to a choice between two spellings of one answer.
  const said = new Set<string>();
  const candidates: CellCandidate[] = [];
  for (const one of found) {
    const key = `${one.attribute}\u0000${one.text}`;
    if (said.has(key)) continue;
    said.add(key);
    candidates.push({
      id: `cand_${candidates.length + 1}`,
      attribute: one.attribute,
      means: CELL_ATTRIBUTE_MEANS[one.attribute],
      text: one.text,
      sourceKeys: one.sourceKeys,
    });
    if (candidates.length === CANDIDATE_CAP) break;
  }
  return candidates;
}

/**
 * The rows of one table a model is asked about, in row order (L-AI-03: the grammar first).
 *
 * A row is asked about only where it carries at least one contested cell that the grammar found a
 * reading of. A row every column of which the deterministic path already settles asks nothing — no
 * request, no ledger row, no cost — and a table whose columns are all headed and all read asks
 * nothing at all, which is the ordinary case and must stay the cheap one.
 */
export function contestedRowsOf(table: ScheduleTable): CellReadingState[] {
  const columns = columnsOfTable(table);
  const rows = rowsOf(table);
  const roles = new Map(columns.map((column) => [column.index, roleOfHeader(column.header)]));
  const taken = takenSilentColumns(columns, rows, roles);

  const states: CellReadingState[] = [];
  for (const [rowIndex, cells] of rows) {
    const contested: ContestedCell[] = [];
    for (const column of columns) {
      if (contested.length === CONTESTED_CELL_CAP) break;
      const cell = cells.get(column.index);
      if (cell === undefined) continue;
      if (!isContested(cell, roles.get(column.index) ?? "silent", taken.has(column.index))) continue;
      const candidates = cellReadingCandidates(cell);
      if (candidates.length === 0) continue;
      contested.push({ columnIndex: column.index, text: cell.text, header: column.header, candidates });
    }
    if (contested.length === 0) continue;

    const ordered = [...cells.entries()].sort((left, right) => left[0] - right[0]).map(([, cell]) => cell);
    states.push({
      title: table.title,
      columns,
      row: {
        index: rowIndex,
        texts: ordered.map((cell) => cell.text),
        // Every key the row's cells were read from, in reading order: what the row's own judgment
        // cites, because the question about the ROW rests on all of its texts (L-CAD-08).
        sourceKeys: [...new Set(ordered.flatMap((cell) => cell.sourceKeys))],
      },
      cells: Object.fromEntries(contested.map((cell) => [String(cell.columnIndex), cell])),
    });
  }
  return states;
}

/**
 * Whether the deterministic path is silent or split about this cell — the only cells a model is put
 * to (L-AI-03).
 *
 * Three ways it is. (1) The column's header names no role the notation vocabulary knows AND the
 * table does not take that column as the one stating its sections or its bands: nothing then says
 * what the cell is for. (2) The draughtsman stacked two texts in the cell and they read as two
 * different attributes: the column says one thing and the cell says two. (3) The column IS headed,
 * and `readNotation` refuses the cell whole: the header says what the column is for and the cell's
 * own words were not read, so whether the row states it is genuinely open.
 */
function isContested(cell: ScheduleCell, role: HeaderRole, columnTaken: boolean): boolean {
  if (role === "silent") return !columnTaken;
  if (stacked(cell) && attributesStated(cell).size > 1) return true;
  return !readNotation(cell.text).ok;
}

/** The attributes the spans of one cell read as, however many spans said each. */
function attributesStated(cell: ScheduleCell): Set<CellAttribute> {
  const said = new Set<CellAttribute>();
  for (const part of cellParts(cell.text)) for (const attribute of spanAttributes(part)) said.add(attribute);
  return said;
}

/**
 * What ONE span of words states about a member: the grammar's reading of it, and the section a pair
 * of sides states.
 *
 * The pair is read beside the grammar rather than through it because a section is not one of the
 * grammar's nine kinds — `300X450` is a cell a schedule writes under its own headed column, and the
 * reader of that column is `parseSizePair` (notation/index.ts). A span the grammar refuses whole is
 * therefore still a reading where it states a section, and a span it reads as a mark is a section
 * where the same pair stands in it.
 *
 * A COMPOUND span that splits into parts states nothing of its own: the parts are spans in their own
 * right and each says what it says, so offering the whole as well would put a model to a choice
 * between `8-20Ø` as the main bars and the whole cell as the main bars — and the second answer
 * would carry the ties into a reading of the bars (L-AI-02: a reading is of the words it names).
 */
function spanAttributes(text: string): CellAttribute[] {
  const read = readNotation(text);
  const said: CellAttribute[] = [];
  if (read.ok && !(read.kind === "compound" && cellParts(text).length > 1)) said.push(...attributesOf(read.kind, read.parsed, text));
  if (parseSizePair(text) !== null && !said.includes("section")) said.push("section");
  return said;
}

/**
 * The silent columns the table itself resolves — the column whose cells state the sections, and the
 * column whose cells state the bands (the `LEVELS` column). A column is what it is for every row, so
 * this is decided once over the whole table and never per cell.
 *
 * Read through the notation module's own parsers rather than through the member-type registry's
 * private choice of those columns: the RULE has one home (`../../notation`), the registry composes it
 * for the registry's question and this composes it for the model's, and neither restates the other.
 */
function takenSilentColumns(
  columns: readonly ScheduleColumn[],
  rows: readonly [number, Map<number, ScheduleCell>][],
  roles: ReadonlyMap<number, HeaderRole>,
): Set<number> {
  const taken = new Set<number>();
  const silent = columns.filter((column) => roles.get(column.index) === "silent");
  const states = (column: ScheduleColumn, reads: (text: string) => boolean): boolean =>
    rows.some(([, cells]) => {
      const cell = cells.get(column.index);
      return cell !== undefined && cellParts(cell.text).some(reads);
    });

  const section = silent.find((column) => states(column, (text) => parseSizePair(text) !== null));
  if (section !== undefined) taken.add(section.index);
  const levels = silent.find((column) => column.index !== section?.index && states(column, (text) => parseFloorZone(text) !== null));
  if (levels !== undefined) taken.add(levels.index);
  return taken;
}

/** What one header makes of its column, the specific before the general (a ties column is a zone). */
function roleOfHeader(header: string): HeaderRole {
  if (isMarkHeader(header)) return "mark";
  if (rebarZoneOfHeader(header) !== null) return "zone";
  return parseFloorZone(header) === null ? "silent" : "band";
}

/** Whether the drawing wrote more than one text into this one cell (L-CAD-08, `CELL_JOIN`). */
function stacked(cell: ScheduleCell): boolean {
  return cell.sourceKeys.length > 1 && cell.text.includes(CELL_JOIN);
}

/** One span of a cell's words, with the keys that span alone was read from. */
type Span = { readonly text: string; readonly sourceKeys: readonly string[] };

/**
 * The spans of one cell: the whole of it, then each stacked part on its own. A part is cited by the
 * one text it came from where the join and the keys line up exactly — `reconstruct` joins the texts
 * in the order it read them — and by the whole cell's keys otherwise, because a citation that guessed
 * which text a part came from would be evidence nobody wrote.
 */
function spansOf(cell: ScheduleCell): Span[] {
  const whole: Span = { text: cell.text, sourceKeys: cell.sourceKeys };
  const parts = cellParts(cell.text);
  if (parts.length < 2) return [whole];
  const aligned = parts.length === cell.sourceKeys.length;
  return [whole, ...parts.map((text, at) => ({ text, sourceKeys: aligned ? [cell.sourceKeys[at] as string] : cell.sourceKeys }))];
}

/**
 * What one reading of the grammar states about a member — a TOTAL map over `NotationKind`, so a kind
 * added to the grammar must be answered here rather than falling through as nothing.
 *
 * A spacing that states two centres states the end zone AND the middle as well as the ties, which is
 * the `10Ø@100/150` a column schedule writes in one cell; a compound is read part by part, each part
 * cited by the whole cell's words because the parts were written together. The kinds that state
 * nothing ABOUT A MEMBER — a concrete grade, a steel grade, a cover, a span fraction, a reference to
 * another sheet — answer none, and a cell that reads as only those is the no-match outcome's own.
 */
function attributesOf(kind: NotationKind, parsed: unknown, text: string): CellAttribute[] {
  switch (kind) {
    case "bar_group":
    case "bar_diameter":
      return ["main"];
    case "spacing": {
      const zoned = parseZonedSpacing(text);
      return zoned !== null && zoned.length > 1 ? ["ties", "ties-end", "ties-mid"] : ["ties"];
    }
    case "dimension_ft_in":
      return ["section"];
    case "level_range":
      return ["band"];
    case "mark":
      return parseSizePair(text) === null ? ["mark"] : ["section"];
    case "compound":
      return compoundAttributes(parsed);
    case "grade_fc":
    case "grade_fy":
    case "cover":
    case "span_fraction":
    case "reference":
      return [];
  }
}

/** The attributes a compound reading states, one pass per part, each part answering what it can. */
function compoundAttributes(parsed: unknown): CellAttribute[] {
  const parts = (parsed as { parts?: readonly { kind: NotationKind; parsed: unknown }[] }).parts;
  if (!Array.isArray(parts)) return [];
  const said: CellAttribute[] = [];
  for (const part of parts) {
    // A compound's parts are already read, so the part's own text is not re-derived here: the two
    // attributes a zoned spacing adds are found on the span itself, one level up.
    for (const attribute of attributesOf(part.kind, part.parsed, "")) {
      if (!said.includes(attribute)) said.push(attribute);
    }
  }
  return said;
}

/** The data rows of a table, by row index ascending, each as its cells by column (row 0 is header). */
function rowsOf(table: ScheduleTable): [number, Map<number, ScheduleCell>][] {
  const rows = new Map<number, Map<number, ScheduleCell>>();
  for (const cell of table.cells) {
    if (cell.rowIndex === 0) continue;
    const held = rows.get(cell.rowIndex) ?? new Map<number, ScheduleCell>();
    held.set(cell.columnIndex, cell);
    rows.set(cell.rowIndex, held);
  }
  return [...rows.entries()].sort((left, right) => left[0] - right[0]);
}
