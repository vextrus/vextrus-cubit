// S-Ask's presenter (docs/design/s-ask.md §1.1, §3, I-398, I-401, I-404): the FACTS the engine answers
// with, written as the product's own sentences out of the one string table, every figure through the
// format seam at the places the facts carry. Pure — no React, no store — so the anatomy of an answer
// is graded by `tests/ui/ask/` over the engine's own answers to the F-RCC6-BNBC read-back.
//
// An answer is written as SEGMENTS: runs of the table's words, the drawing's codes (a mark, a level
// label, a sheet number — model data, set in mono), figures (each an EvidenceLink carrying its exact
// value), the unit a figure is measured in (a UnitBadge, never inside the link, L-FMT-02), and quotes
// of the drawing's own words (I-401). The screen renders segments and composes nothing of its own.
import { inWords } from "@/core/documents/kinds/boq-draft-law";
import { REFUSALS, type RefusalEntry } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import { NOTE_KINDS } from "@/core/notes/law";
import type {
  AskAnswer,
  AskBasis,
  AskBreakdownRow,
  AskFacts,
  AskFigure,
  AskHeld,
  AskOffered,
  AskPartial,
  AskPlace,
  AskReading,
  AskReadingRecord,
  AskRoutedBy,
  AskScheduleSheet,
  AskSheet,
  AskStatementFacts,
  AskTextHit,
} from "@/modules/takeoff/ask/law";
import { statedAt } from "@/modules/takeoff/bbs-ui/present";
import { markOrder } from "@/modules/takeoff/register-ui/order";
import { originAddress, selectionAddress, traceAddress } from "@/modules/takeoff/trace/address";
import type { Basis } from "@/ui/primitives/core/basis";
import { fill, strings } from "@/ui/strings";

/** The register's lawful-null slot a foundation object is filed under (the engine's `FOUNDATION_SLOT`). */
const FOUNDATION_SLOT = "FOUNDATION";

/** How a list is joined wherever §3 states one (`{sheets}`, `{levels}`, `{list}`, `{groups}`). */
const LIST_JOIN = " · ";

/* ------------------------------------------------------------------------------ segments */

/** One run of an answer's words, as the screen renders it. */
export type Seg =
  | { readonly t: "text"; readonly text: string }
  /** The drawing's own code — a mark, a level label, a sheet number: model data, in mono. */
  | { readonly t: "code"; readonly text: string }
  /** A figure: an EvidenceLink over its face, exact on `data-value` (I-398, I-404). */
  | { readonly t: "figure"; readonly face: string; readonly figure: AskFigure; readonly href: string; readonly basis: Basis }
  /** The unit a figure is measured in, rendered from the code by a UnitBadge (L-FMT-02). */
  | { readonly t: "unit"; readonly unit: string }
  /** The drawing's own characters, quoted: an EvidenceLink where the entity is placed (I-401). */
  | { readonly t: "quote"; readonly text: string; readonly href: string | null }
  /** A place a reader follows — a sheet, a register row — worded by the table. */
  | { readonly t: "link"; readonly label: string; readonly href: string; readonly basis: Basis; readonly code: boolean }
  /** A closed enum's value, humanised by EnumLabel. */
  | { readonly t: "enum"; readonly value: string };

/** Where the links of one answer lead: the project, and the answer's own evidence row. */
export type Links = {
  readonly tenantId: string;
  readonly projectId: string;
  readonly answerId: string;
  /** Whether the answer names any place — its evidence row stands only then. */
  readonly anyPlace: boolean;
};

const text = (value: string): Seg => ({ t: "text", text: value });
const code = (value: string): Seg => ({ t: "code", text: value });

/** A whole count as a reader reads one: grouped by the format seam (L-FMT-02). */
export function countFace(count: number): string {
  return formatUserFigure(String(count));
}

/** A figure's face: the exact decimal stated at the places the facts carry, grouped by the seam. */
export function faceOf(figure: AskFigure): string {
  return formatUserFigure(statedAt(figure.value, figure.places));
}

/** The id of an answer's evidence row, which a figure standing on several sheets links to (I-404). */
export function evidenceId(answerId: string): string {
  return `ask-evidence-${answerId}`;
}

/** The id of an answer's Rows disclosure, which a figure standing on no placed sheet links to. */
export function rowsId(answerId: string): string {
  return `ask-rows-${answerId}`;
}

/** The viewer at one place, selecting every key the answer cites there (I-404). */
export function placeHref(links: Pick<Links, "tenantId" | "projectId">, place: AskPlace): string {
  return selectionAddress(links.tenantId, links.projectId, { drawingId: place.drawingId, layoutName: place.layoutName, sourceKeys: place.keys });
}

/**
 * Where a figure links (I-404): the one (drawing, layout) its members stand on, selecting them all;
 * else its answer's evidence row, which names every place — one click from all of them and never
 * from a part; else, where no member is placed on any sheet, the Rows that list them.
 */
export function figureHref(figure: AskFigure, links: Links): string {
  const [only, second] = figure.at;
  if (only !== undefined && second === undefined) return placeHref(links, only);
  return `#${links.anyPlace ? evidenceId(links.answerId) : rowsId(links.answerId)}`;
}

function figureSeg(figure: AskFigure, links: Links, basis: Basis = "MEASURED"): Seg {
  return { t: "figure", face: faceOf(figure), figure, href: figureHref(figure, links), basis };
}

/** A sheet as a reader names it: the number the title block states, else the layout, else model space. */
export function sheetName(place: { readonly sheetLabel: string | null; readonly layoutName: string | null }): string {
  return place.sheetLabel ?? place.layoutName ?? strings.ask_show_model;
}

/**
 * One template of the table, its placeholders filled with segments. A fragment the question did not
 * call for is handed as no segments and taken out with the space before it; a statement's first
 * letter is capitalised here and nothing else is (§3).
 */
export function composeLine(template: string, values: Readonly<Record<string, readonly Seg[]>>, capitalise = true): Seg[] {
  const out: Seg[] = [];
  const push = (seg: Seg): void => {
    const last = out[out.length - 1];
    if (seg.t === "text" && last !== undefined && last.t === "text") out[out.length - 1] = text(last.text + seg.text);
    else out.push(seg);
  };
  const pattern = /\{(\w+)\}/gu;
  let at = 0;
  for (const match of template.matchAll(pattern)) {
    if (match.index > at) push(text(template.slice(at, match.index)));
    const filled = values[match[1] as string];
    if (filled === undefined) push(text(match[0]));
    else for (const seg of filled) push(seg);
    at = match.index + match[0].length;
  }
  if (at < template.length) push(text(template.slice(at)));
  // An omitted fragment leaves its space behind: collapse the doubled space, and the space before a
  // stop, a colon or a comma, so "{count} {class} {marked} {where}." reads "1 column." (§3).
  const tidied = out
    .map((seg, index) => {
      if (seg.t !== "text") return seg;
      let value = seg.text.replace(/\s{2,}/gu, " ").replace(/\s+([.,:])/gu, "$1");
      if (index === 0) value = value.replace(/^\s+/u, "");
      return text(value);
    })
    .filter((seg) => seg.t !== "text" || seg.text !== "");
  if (!capitalise) return tidied;
  const first = tidied[0];
  if (first !== undefined && first.t === "text") tidied[0] = text(`${first.text.slice(0, 1).toUpperCase()}${first.text.slice(1)}`);
  return tidied;
}

const table = strings as unknown as Readonly<Record<string, string | undefined>>;

/** A table entry by a key built from a roster member, or the member itself where the table holds none. */
function said(key: string, fallback: string): string {
  return table[key] ?? fallback;
}

/** A catalogue key as a string-table key: its dot as an underscore (§3 — no key carries a dot). */
export function keyed(member: string): string {
  return member.replace(/\./gu, "_").toLowerCase();
}

/** A class in words, singular for one and plural otherwise (§3's classes). */
export function classWord(klass: string | null, count: number): string {
  if (klass === null) return "";
  return said(`ask_class_${keyed(klass)}_${count === 1 ? "one" : "other"}`, klass);
}

/** A kind across classes, in its trade words (§3's `{trade}`). */
export function tradeWord(kind: string): string {
  return said(`ask_trade_${keyed(kind)}`, kind);
}

/** A (class, kind), in words (§3's `{phrase}`); a kind asked of no class is its trade. */
export function phraseOf(klass: string | null, kind: string): string {
  if (klass === null) return tradeWord(kind);
  const template = table[`ask_kind_${keyed(kind)}`];
  return template === undefined ? `${classWord(klass, 1)} ${tradeWord(kind)}` : fill(template, { class: classWord(klass, 1), classes: classWord(klass, 2) });
}

/** Whether a reading's subject is a note kind (else it is the level a storey height was read for). */
function isNoteKind(value: string): boolean {
  return (NOTE_KINDS as readonly string[]).includes(value);
}

/** A note kind in words. */
export function noteWord(noteKind: string): string {
  return said(`ask_note_kind_${keyed(noteKind)}`, noteKind);
}

/** The `{where}` fragment: on a level, in the foundation, or nothing where the question named none. */
function whereOf(level: string | null): Seg[] {
  if (level === null) return [];
  if (level === FOUNDATION_SLOT) return [text(strings.ask_where_foundation)];
  return composeLine(strings.ask_where_level, { level: [code(level)] }, false);
}

/** The `{marked}` fragment. */
function markedOf(mark: string | null): Seg[] {
  return mark === null ? [] : composeLine(strings.ask_marked, { mark: [code(mark)] }, false);
}

/** The `{lines}` fragment: how many complete lines a figure was summed from. */
function linesOf(count: number): Seg[] {
  return [text(count === 1 ? strings.ask_lines_one : fill(strings.ask_lines_other, { lines: countFace(count) }))];
}

/** Segments read as plain words — for a lead that carries no code and no figure. */
export function plain(segs: readonly Seg[]): string {
  return segs.map((seg) => (seg.t === "text" || seg.t === "code" || seg.t === "quote" ? seg.text : seg.t === "figure" ? seg.face : seg.t === "unit" ? seg.unit : seg.t === "link" ? seg.label : seg.value)).join("");
}

/** A list of words or codes joined by the one joiner. */
function listOf(items: readonly Seg[][]): Seg[] {
  return items.flatMap((item, index) => (index === 0 ? item : [text(LIST_JOIN), ...item]));
}

/** A figure's unit, where it has one. */
function unitOf(figure: AskFigure): Seg[] {
  return figure.unit === null ? [] : [{ t: "unit", unit: figure.unit }];
}

/* ----------------------------------------------------------------------- the Understood row */

const INTENT_WORD: Readonly<Record<string, string>> = Object.freeze({
  COUNT: strings.ask_intent_count,
  MARKS: strings.ask_intent_marks,
  QUANTITY: strings.ask_intent_quantity,
  MEASURED_SO_FAR: strings.ask_intent_measured_so_far,
  WHY_NOT_MEASURED: strings.ask_intent_why_not_measured,
  MEMBER_TYPE: strings.ask_intent_member_type,
  NOTE: strings.ask_intent_note,
  LEVEL_HEIGHT: strings.ask_intent_level_height,
  SCHEDULE_SHEET: strings.ask_intent_schedule_sheet,
  FIND_TEXT: strings.ask_intent_find_text,
  SHEET_LIST: strings.ask_intent_sheet_list,
});

/** An intent in words (§3's intent words); the roster's own name where the table holds none. */
export function intentWord(intent: string): string {
  return INTENT_WORD[intent] ?? intent;
}

/** A capitalised word — the Understood row's items are each a word a reader reads on its own. */
function capital(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

/**
 * What a question was read as, word by word (§1.1 2): the intent, the class and the kind in words, a
 * mark and a level verbatim (the drawing's codes), a breakdown, a note kind, a discipline.
 */
export function readingWords(reading: AskReading): Seg[][] {
  const words: Seg[][] = [[text(intentWord(reading.intent))]];
  if (reading.class !== null) words.push([text(inWords(reading.class))]);
  if (reading.kind !== null) words.push([text(reading.class === null ? capital(tradeWord(reading.kind)) : inWords(reading.kind))]);
  if (reading.mark !== null) words.push([code(reading.mark)]);
  if (reading.level !== null) words.push(reading.level === FOUNDATION_SLOT ? [text(capital(strings.ask_where_foundation))] : [code(reading.level)]);
  if (reading.by !== null) words.push([text(reading.by === "LEVEL" ? strings.ask_by_level : strings.ask_by_mark)]);
  if (reading.noteKind !== null) words.push([text(capital(noteWord(reading.noteKind)))]);
  if (reading.discipline !== null) words.push([{ t: "enum", value: reading.discipline }]);
  // The words a sheet-text question searched for, quoted as asked (I-676).
  if (reading.text !== null) words.push([{ t: "quote", text: reading.text, href: null }]);
  return words;
}

/** The one qualifier the Understood row may carry after the reading (§1.1 2), or null. */
export function qualifierOf(answer: { readonly routedBy: AskRoutedBy; readonly followUp: boolean; readonly reading: AskReading }, unit: string | null): string | null {
  if (answer.routedBy === "MODEL") return strings.ask_understood_machine;
  if (answer.routedBy === "PERSON") return strings.ask_understood_chosen;
  if (answer.followUp) return strings.ask_understood_follow_up;
  if (answer.reading.unitAsked !== null && unit !== null) return fill(strings.ask_understood_unit, { unit });
  return null;
}

/** A reading a clarify offers, as its button reads it: the level's gloss, else its Understood words. */
export function offeredLabel(offered: AskOffered): string {
  if (offered.gloss !== null) {
    const template = offered.gloss.count === "FLOOR" ? strings.ask_level_reading_floor : strings.ask_level_reading_storey;
    return fill(template, { label: offered.gloss.label, n: String(offered.gloss.n) });
  }
  return readingWords(offered.reading)
    .map((word) => word.map((seg) => (seg.t === "text" || seg.t === "code" ? seg.text : seg.t === "enum" ? capital(seg.value.toLowerCase()) : "")).join(""))
    .join(LIST_JOIN);
}

/* --------------------------------------------------------------------------- the statement */

/** The unit an answer's figure is measured in, where it names one — what `ask_understood_unit` says. */
export function unitOfFacts(statement: AskStatementFacts): string | null {
  if (statement.intent === "QUANTITY") return statement.figure?.unit ?? null;
  if (statement.intent === "MEASURED_SO_FAR") return statement.trades[0]?.unit ?? null;
  return null;
}

function apartLine(apart: NonNullable<Extract<AskStatementFacts, { intent: "QUANTITY" }>["apart"]>, links: Links): Seg[] {
  const phrase = apart.classes.length === 1 ? phraseOf(apart.classes[0] as string, apart.kind) : tradeWord(apart.kind);
  return composeLine(strings.ask_so_far_apart, { phrase: [text(phrase)], figure: [figureSeg(apart.figure, links)], unit: unitOf(apart.figure), lines: linesOf(apart.lines) });
}

/** The levels a typical plan stands for, from the ground up: `{first} to {last}`, or the one. */
function levelsSpan(levels: readonly string[]): Seg[] {
  const first = levels[0];
  const last = levels[levels.length - 1];
  if (first === undefined || last === undefined) return [];
  if (first === last) return [code(first)];
  return composeLine(strings.ask_levels_range, { first: [code(first)], last: [code(last)] }, false);
}

/** A place a sheet-text answer names, as a link to it selecting what stands there, or model space in words. */
function placeLink(place: AskPlace | null, links: Links): Seg[] {
  if (place === null) return [text(strings.ask_show_model)];
  return [{ t: "link", label: sheetName(place), href: placeHref(links, place), basis: "TRANSCRIBED", code: place.sheetLabel !== null }];
}

/**
 * A sheet question's statements (§3 `ask_schedule_sheet`): one per title the schedules asked after
 * are captioned by, naming every sheet a caption of that title stands on, each a link selecting it.
 */
function scheduleSheetRows(schedules: readonly AskScheduleSheet[], links: Links): Seg[][] {
  const byTitle = new Map<string, AskScheduleSheet[]>();
  for (const schedule of schedules) byTitle.set(schedule.title, [...(byTitle.get(schedule.title) ?? []), schedule]);
  return [...byTitle.entries()].map(([title, held]) => {
    const places: (AskPlace | null)[] = [];
    for (const one of held) {
      const same = places.some((place) => (place === null ? one.place === null : one.place !== null && place.drawingId === one.place.drawingId && place.layoutName === one.place.layoutName));
      if (!same) places.push(one.place);
    }
    return composeLine(strings.ask_schedule_sheet, { title: [text(title)], sheets: listOf(places.map((place) => placeLink(place, links))) });
  });
}

/** An answer's statement rows (§1.1 3), one statement each, in the order §3 writes them. */
export function statementRows(answer: Extract<AskAnswer, { outcome: "ANSWERED" }>, links: Links): Seg[][] {
  const { reading } = answer;
  const statement = answer.facts.statement;
  const where = whereOf(reading.level);
  switch (statement.intent) {
    case "COUNT": {
      const n = Number(statement.count.value);
      const rows: Seg[][] = [
        n === 0
          ? composeLine(strings.ask_count_none, { classes: [text(classWord(reading.class, 2))], marked: markedOf(reading.mark), where })
          : composeLine(strings.ask_count, { count: [figureSeg(statement.count, links)], class: [text(classWord(reading.class, n))], marked: markedOf(reading.mark), where }),
      ];
      if (statement.typical !== null) rows.push(composeLine(strings.ask_count_typical, { levels: levelsSpan(statement.typical.levels) }));
      if (statement.struck > 0) {
        rows.push(
          statement.struck === 1
            ? composeLine(strings.ask_count_struck_one, { class: [text(classWord(reading.class, 1))] })
            : composeLine(strings.ask_count_struck_other, { count: [text(countFace(statement.struck))], classes: [text(classWord(reading.class, 2))] }),
        );
      }
      return rows;
    }
    case "MARKS":
      return [composeLine(strings.ask_marks, { classes: [text(classWord(reading.class, 2))], count: [figureSeg(statement.total, links)] })];
    case "QUANTITY": {
      const phrase = [text(reading.kind === null ? "" : phraseOf(reading.class, reading.kind))];
      const rows: Seg[][] = [
        statement.figure === null
          ? composeLine(strings.ask_quantity_none, { phrase, where })
          : composeLine(strings.ask_quantity, { phrase, where, figure: [figureSeg(statement.figure, links)], unit: unitOf(statement.figure), lines: linesOf(statement.lines) }),
      ];
      if (statement.apart !== null) rows.push(apartLine(statement.apart, links));
      return rows;
    }
    case "MEASURED_SO_FAR": {
      const rows: Seg[][] = [];
      const [only, second] = statement.trades;
      if (only !== undefined && second === undefined && only.figure !== null) {
        rows.push(composeLine(strings.ask_so_far, { trade: [text(tradeWord(only.kind))], figure: [figureSeg(only.figure, links)], unit: unitOf(only.figure), lines: linesOf(only.lines) }));
      } else {
        rows.push([text(strings.ask_so_far_all)]);
      }
      rows.push([text(strings.ask_so_far_not_total)]);
      if (statement.without.length > 0) {
        const groups = statement.without.map((group) => composeLine(strings.ask_group_count, { phrase: [text(phraseOf(group.class, group.kind))], count: [text(countFace(group.count))] }, false));
        rows.push(composeLine(strings.ask_so_far_without, { groups: listOf(groups) }));
      }
      const absent = [...new Set(statement.trades.flatMap((trade) => trade.absent))];
      if (absent.length > 0) rows.push(composeLine(strings.ask_so_far_absent, { list: listOf(absent.map((klass) => [text(classWord(klass, 2))])) }));
      if (statement.apart !== null) rows.push(apartLine(statement.apart, links));
      return rows;
    }
    case "WHY_NOT_MEASURED": {
      const subject: Seg[] =
        reading.kind !== null
          ? [text(phraseOf(reading.class, reading.kind))]
          : [text(classWord(reading.class, reading.mark === null ? 2 : 1)), ...(reading.mark === null ? [] : [text(" "), code(reading.mark)])];
      if (statement.lines === 0 && answer.facts.partial === null) {
        return [composeLine(strings.ask_why_none, { subject, where, class: [text(classWord(reading.class, 1))] })];
      }
      if (statement.lines === 0) return [];
      return [
        statement.lines === 1
          ? composeLine(strings.ask_why_one, { subject, where })
          : composeLine(strings.ask_why_other, { subject, where, count: [text(countFace(statement.lines))] }),
      ];
    }
    case "MEMBER_TYPE":
      return [composeLine(strings.ask_member_type, { mark: [code(reading.mark ?? "")] })];
    case "NOTE":
      return statement.groups.flatMap((group) => {
        const rows = [composeLine(strings.ask_note, { note: [text(noteWord(group.noteKind))] })];
        if (group.values > 1) rows.push(composeLine(strings.ask_note_disagree, { count: [text(countFace(group.values))] }));
        return rows;
      });
    case "LEVEL_HEIGHT":
      return statement.heights.map((height) => {
        const level = [code(height.level)];
        if (height.figure !== null) return composeLine(strings.ask_level_height, { level, figure: [figureSeg(height.figure, links, "TRANSCRIBED")], unit: unitOf(height.figure) });
        if (height.readings.length > 1) return composeLine(strings.ask_level_height_suspended, { level, count: [text(countFace(height.readings.length))] });
        return composeLine(strings.ask_level_height_none, { level });
      });
    case "SCHEDULE_SHEET":
      return scheduleSheetRows(statement.schedules, links);
    case "FIND_TEXT": {
      const found = Number(statement.count.value);
      const asked = [text(statement.text)];
      if (found === 0) return [composeLine(strings.ask_find_none, { text: asked })];
      if (found === 1) return [composeLine(strings.ask_find_one, { text: asked })];
      return [composeLine(strings.ask_find_other, { text: asked, count: [figureSeg(statement.count, links, "DERIVED")] })];
    }
    case "SHEET_LIST":
      return [
        Number(statement.count.value) === 1
          ? [text(strings.ask_sheets_one)]
          : composeLine(strings.ask_sheets_other, { count: [figureSeg(statement.count, links, "DERIVED")] }),
      ];
  }
}

/* --------------------------------------------------------------------- tables: breakdown, rows */

/** One column of an answer's table: its id, its header, and whether its figures read right-aligned. */
export type Column = { readonly id: string; readonly header: string; readonly numeric: boolean };

/** One row: its id and a cell of segments per column. */
export type Row = { readonly id: string; readonly cells: Readonly<Record<string, readonly Seg[]>> };

/** An answer's table: the shipped DataTable under its own table id (§1.1 3, 6). */
export type Table = { readonly tableId: string; readonly columns: readonly Column[]; readonly rows: readonly Row[] };

const COL = Object.freeze({
  level: { id: "level", header: strings.ask_col_level, numeric: false },
  class: { id: "class", header: strings.ask_col_class, numeric: false },
  mark: { id: "mark", header: strings.ask_col_mark, numeric: false },
  count: { id: "count", header: strings.ask_col_count, numeric: true },
  lines: { id: "lines", header: strings.ask_col_lines, numeric: true },
  kind: { id: "kind", header: strings.ask_col_kind, numeric: false },
  value: { id: "value", header: strings.ask_col_value, numeric: true },
  source: { id: "source", header: strings.ask_col_source, numeric: false },
  register: { id: "register", header: strings.ask_col_register, numeric: false },
  sheet: { id: "sheet", header: strings.ask_col_sheet, numeric: false },
  what: { id: "what", header: strings.ask_col_what, numeric: false },
  clause: { id: "clause", header: strings.ask_col_clause, numeric: false },
  schedule: { id: "schedule", header: strings.ask_col_schedule, numeric: false },
  row: { id: "row", header: strings.ask_col_row, numeric: true },
  column: { id: "column", header: strings.ask_col_column, numeric: false },
  title: { id: "title", header: strings.ask_col_title, numeric: false },
  text: { id: "text", header: strings.ask_col_text, numeric: false },
  discipline: { id: "discipline", header: strings.ask_col_discipline, numeric: false },
} satisfies Record<string, Column>);

/** A figure cell: the figure's EvidenceLink and its unit after it. */
function figureCell(figure: AskFigure | null, links: Links, basis: Basis = "MEASURED"): Seg[] {
  return figure === null ? [] : [figureSeg(figure, links, basis), ...unitOf(figure)];
}

function breakdownRows(rows: readonly AskBreakdownRow[], counted: boolean, links: Links, kind?: string): Row[] {
  return rows.map((row, index) => ({
    id: `${kind ?? ""}|${row.level ?? ""}|${row.mark ?? ""}|${row.class ?? ""}|${index}`,
    cells: {
      ...(kind === undefined ? {} : { kind: [text(capital(tradeWord(kind)))] }),
      level: row.level === null ? [] : row.level === FOUNDATION_SLOT ? [text(capital(strings.ask_where_foundation))] : [code(row.level)],
      mark: row.mark === null ? [] : [code(row.mark)],
      class: row.class === null ? [] : [text(inWords(row.class))],
      count: counted ? figureCell(row.figure, links) : [],
      lines: [text(countFace(row.count))],
      value: counted ? [] : figureCell(row.figure, links),
    },
  }));
}

/** A reading's Value cell: the quote, else the figure (I-401 — a storey height is never a quote). */
function readingValue(record: AskReadingRecord, links: Links): Seg[] {
  if (record.quote !== null) {
    const place = record.drawingId !== null && record.layoutName !== null && record.sourceKey !== null ? { drawingId: record.drawingId, layoutName: record.layoutName, sheetLabel: record.sheetLabel, keys: [record.sourceKey] } : null;
    return [{ t: "quote", text: record.quote, href: place === null ? null : placeHref(links, place) }];
  }
  return figureCell(record.figure, links, "TRANSCRIBED");
}

function readingRows(records: readonly AskReadingRecord[], links: Links): Row[] {
  return records.map((record) => ({
    id: record.readingKey,
    cells: {
      sheet: [text(sheetName(record))],
      what: isNoteKind(record.what) ? [text(capital(noteWord(record.what)))] : [code(record.what)],
      value: readingValue(record, links),
      clause: record.clause === null ? [] : [{ t: "quote", text: record.clause, href: null }],
    },
  }));
}

function sheetRows(sheets: readonly AskSheet[], links: Links): Row[] {
  return sheets.map((sheet) => ({
    id: `${sheet.drawingId}|${sheet.layoutName}`,
    cells: {
      sheet: [{ t: "link", label: sheet.number ?? sheet.layoutName, href: placeHref(links, { drawingId: sheet.drawingId, layoutName: sheet.layoutName, sheetLabel: sheet.number, keys: [] }), basis: "DERIVED", code: true }],
      title: [text(sheet.title)],
      discipline: [{ t: "enum", value: sheet.discipline }],
    },
  }));
}

/**
 * The texts a find rests on (§1.1 6): the sheet each stands on, what it says — quoted, marked where
 * the row shows only part of the paragraph, a link selecting that text on its sheet — and, for a text
 * core's resolver stands on no sheet, its key whole and no link (I-404).
 */
function textRows(hits: readonly AskTextHit[], links: Links): Row[] {
  const elided = strings.command_palette_elision;
  return hits.map((hit) => {
    const place = hit.layoutName === null ? null : { drawingId: hit.drawingId, layoutName: hit.layoutName, sheetLabel: hit.sheetLabel, keys: [hit.sourceKey] };
    const said = `${hit.clippedStart ? elided : ""}${hit.excerpt}${hit.clippedEnd ? elided : ""}`;
    return {
      id: `${hit.drawingId}|${hit.sourceKey}`,
      cells: {
        sheet: [text(sheetName(hit))],
        text: [{ t: "quote", text: said, href: place === null ? null : placeHref(links, place) }],
        source: place === null ? [code(hit.sourceKey)] : [],
      },
    };
  });
}

/**
 * The breakdown under the statement (§1.1 3): by level or by mark where the question asked so, the
 * marks a class holds, every trade measured so far, a schedule's cells, the readings a note or a
 * storey height rests on, the sheets of the set. Null where the statement needs none.
 */
export function breakdownOf(answer: Extract<AskAnswer, { outcome: "ANSWERED" }>, links: Links): Table | null {
  const statement = answer.facts.statement;
  switch (statement.intent) {
    case "MARKS":
      return { tableId: "ask-breakdown-marks", columns: [COL.mark, COL.count], rows: breakdownRows(statement.marks, true, links) };
    case "QUANTITY": {
      if (statement.breakdown === null) return null;
      const by = answer.reading.by === "MARK" ? COL.mark : COL.level;
      return { tableId: `ask-breakdown-${by.id}`, columns: [by, COL.lines, COL.value], rows: breakdownRows(statement.breakdown, false, links) };
    }
    case "MEASURED_SO_FAR": {
      const [only, second] = statement.trades;
      if (only !== undefined && second === undefined && only.figure !== null && only.classes.length <= 1) return null;
      return {
        tableId: "ask-breakdown-trades",
        columns: [COL.kind, COL.class, COL.lines, COL.value],
        rows: statement.trades.flatMap((trade) => breakdownRows(trade.classes, false, links, trade.kind)),
      };
    }
    case "MEMBER_TYPE":
      return {
        tableId: "ask-breakdown-cells",
        columns: [COL.schedule, COL.row, COL.column, COL.value],
        rows: statement.rows.flatMap((row) =>
          row.cells.map((cell, index) => ({
            id: `${cell.scheduleKey}|${cell.rowIndex}|${index}`,
            cells: {
              schedule: [{ t: "quote", text: cell.schedule, href: null }],
              row: [text(countFace(cell.rowIndex + 1))],
              column: cell.column === null ? [] : [{ t: "quote", text: cell.column, href: null }],
              value: [{ t: "quote", text: cell.text, href: cell.place === null ? null : placeHref(links, cell.place) }],
            },
          })),
        ),
      };
    case "NOTE":
      return { tableId: "ask-breakdown-readings", columns: [COL.sheet, COL.what, COL.value, COL.clause], rows: readingRows(statement.groups.flatMap((group) => group.readings), links) };
    case "LEVEL_HEIGHT": {
      const readings = statement.heights.flatMap((height) => height.readings);
      return readings.length === 0 ? null : { tableId: "ask-breakdown-readings", columns: [COL.sheet, COL.what, COL.value, COL.clause], rows: readingRows(readings, links) };
    }
    case "SHEET_LIST":
      return { tableId: "ask-breakdown-sheets", columns: [COL.sheet, COL.title, COL.discipline], rows: sheetRows(statement.sheets, links) };
    case "FIND_TEXT":
      return statement.places.length === 0
        ? null
        : {
            tableId: "ask-breakdown-finds",
            columns: [COL.sheet, COL.count],
            rows: statement.places.map((one) => ({ id: `${one.place.drawingId}|${one.place.layoutName}`, cells: { sheet: placeLink(one.place, links), count: figureCell(one.count, links, "DERIVED") } })),
          };
    default:
      return null;
  }
}

/** Every record an answer rests on, one table per kind of record (§1.1 6's Rows). */
export function rowsTablesOf(facts: AskFacts, links: Links): Table[] {
  const tables: Table[] = [];
  const { records } = facts;
  if (records.lines.length > 0) {
    tables.push({
      tableId: "ask-rows-lines",
      columns: [COL.level, COL.mark, COL.kind, COL.value, COL.source, COL.register],
      rows: records.lines.map((line) => {
        const traced = line.drawingId !== null && line.layoutName !== null;
        const href = traced ? traceAddress(links.tenantId, links.projectId, line) : `#${rowsId(links.answerId)}`;
        const value: Seg[] =
          line.value === null
            ? [text(fill(strings.ask_value_unstated, { variables: line.omitted.map((one) => one.variable).join(", ") }))]
            : [
                { t: "figure", face: formatUserFigure(statedAt(line.value, line.places ?? 3)), figure: { value: line.value, unit: line.unit, kind: null, places: line.places ?? 3, at: [] }, href, basis: "MEASURED" },
                { t: "unit", unit: line.unit },
              ];
        return {
          id: line.lineId,
          cells: {
            level: [code(line.level)],
            mark: [code(line.mark)],
            kind: [text(inWords(line.kind))],
            value,
            source: traced ? [{ t: "link", label: sheetName(line), href, basis: "MEASURED", code: true }] : [code(line.objectKey)],
            register: [{ t: "link", label: strings.ask_open_in_register, href: originAddress(links.tenantId, links.projectId, line.lineId), basis: "DERIVED", code: false }],
          },
        };
      }),
    });
  }
  if (records.objects.length > 0) {
    tables.push({
      tableId: "ask-rows-objects",
      columns: [COL.level, COL.class, COL.mark, COL.source],
      rows: records.objects.map((object) => ({
        id: object.objectKey,
        cells: {
          level: [code(object.level)],
          class: [text(inWords(object.class))],
          mark: [code(object.mark)],
          source: object.place === null ? [code(object.sourceKey)] : [{ t: "link", label: sheetName(object.place), href: placeHref(links, object.place), basis: "MEASURED", code: true }],
        },
      })),
    });
  }
  if (records.readings.length > 0) tables.push({ tableId: "ask-rows-readings", columns: [COL.sheet, COL.what, COL.value, COL.clause], rows: readingRows(records.readings, links) });
  if (records.cells.length > 0) {
    tables.push({
      tableId: "ask-rows-cells",
      columns: [COL.schedule, COL.row, COL.column, COL.value],
      rows: records.cells.map((cell, index) => ({
        id: `${cell.scheduleKey}|${cell.rowIndex}|${index}`,
        cells: {
          schedule: [{ t: "quote", text: cell.schedule, href: null }],
          row: [text(countFace(cell.rowIndex + 1))],
          column: cell.column === null ? [] : [{ t: "quote", text: cell.column, href: null }],
          value: [{ t: "quote", text: cell.text, href: cell.place === null ? null : placeHref(links, cell.place) }],
        },
      })),
    });
  }
  if (records.sheets.length > 0) tables.push({ tableId: "ask-rows-sheets", columns: [COL.sheet, COL.title, COL.discipline], rows: sheetRows(records.sheets, links) });
  if (records.texts.length > 0) tables.push({ tableId: "ask-rows-texts", columns: [COL.sheet, COL.text, COL.source], rows: textRows(records.texts, links) });
  return tables;
}

/** How many records an answer rests on — the Rows summary's count. */
export function recordCount(facts: AskFacts): number {
  const { records } = facts;
  return records.lines.length + records.objects.length + records.readings.length + records.cells.length + records.sheets.length + records.texts.length;
}

/* ------------------------------------------------------------------------ what is left out */

/** One code's row under the partial block: the count, the registry's message, its remedy as a hint. */
export type CodeRow = { readonly key: string; readonly text: string; readonly remedy: string | null };

/**
 * The partial block (§1.1 4): its leads and one row per code, each once; the registered objects left
 * with no line are named by their marks beside their lead, so the reader knows WHICH member is out.
 */
export type PartialRows = {
  readonly lines: { readonly lead: string | null; readonly marks: readonly string[]; readonly rows: readonly CodeRow[] };
  readonly objects: { readonly lead: string | null; readonly marks: readonly string[]; readonly rows: readonly CodeRow[] };
};

function codeRows(counts: AskPartial["codes"], prefix: string): CodeRow[] {
  return counts.map((one) => {
    const entry = one.code === null ? undefined : (REFUSALS as Readonly<Record<string, RefusalEntry | undefined>>)[one.code];
    return { key: `${prefix}|${one.code ?? "none"}`, text: fill(strings.ask_partial_row, { count: countFace(one.count), message: entry?.message ?? strings.ask_partial_unrecorded }), remedy: entry?.remedy ?? null };
  });
}

/**
 * What an answer leaves out (I-399), in words: the PARTIAL lines by the registry's message for each
 * code, and the registered objects with no line by the reason their sighting stood. Under a "why not
 * measured" answer the statement has already counted the lines, so their lead is not repeated.
 */
export function partialRowsOf(partial: AskPartial, reading: AskReading, statementCountsLines: boolean, lineless: readonly string[] = []): PartialRows {
  const linesLead = statementCountsLines || partial.lines === 0 ? null : partial.lines === 1 ? strings.ask_partial_lines_one : fill(strings.ask_partial_lines_other, { count: countFace(partial.lines) });
  const objectsLead =
    partial.objects === 0
      ? null
      : plain(
          partial.objects === 1
            ? composeLine(strings.ask_partial_objects_one, { class: [text(classWord(reading.class, 1))] }, false)
            : composeLine(strings.ask_partial_objects_other, { count: [text(countFace(partial.objects))], classes: [text(classWord(reading.class, 2))] }, false),
        );
  return {
    lines: { lead: linesLead, marks: [], rows: partial.lines === 0 ? [] : codeRows(partial.codes, "line") },
    objects: { lead: objectsLead, marks: partial.objects === 0 ? [] : [...new Set(lineless)].sort(markOrder), rows: partial.objects === 0 ? [] : codeRows(partial.reasons, "object") },
  };
}

/**
 * The marks of the registered objects an answer names as having no line. Under a quantity and a "why
 * not measured" answer the records' objects ARE those objects (the queries record the lineless ones
 * there); under any other intent the records' objects are what was counted, and no mark is named.
 */
export function linelessMarks(answer: Extract<AskAnswer, { outcome: "ANSWERED" }>): string[] {
  const intent = answer.facts.statement.intent;
  if (intent !== "QUANTITY" && intent !== "WHY_NOT_MEASURED") return [];
  return answer.facts.records.objects.map((object) => object.mark).filter((mark) => mark.trim() !== "");
}

/* ------------------------------------------------------------------------ refusals and basis */

/** What the project holds, beneath `ASK_SUBJECT_UNKNOWN` (§3's `ask_held_*`). */
export function heldLine(held: AskHeld): Seg[] {
  const items = held.items.map((item) => (held.subject === "MARKS" || held.subject === "LEVELS" || held.subject === "SHEETS" ? [code(item)] : [{ t: "quote", text: item, href: null } as Seg]));
  const list = listOf(items);
  switch (held.subject) {
    case "MARKS":
      return held.class === null ? composeLine(strings.ask_held_marks_any, { list }) : composeLine(strings.ask_held_marks, { classes: [text(classWord(held.class, 2))], list });
    case "LEVELS":
      return composeLine(strings.ask_held_levels, { list });
    case "SHEETS":
      return composeLine(strings.ask_held_sheets, { list });
    case "SCHEDULES":
      return composeLine(strings.ask_held_schedules, { list });
    case "NOTES":
      return composeLine(strings.ask_held_notes, { list: listOf(held.items.map((item) => [text(noteWord(item))])) });
  }
}

/** Where an answer was read from (§3's `ask_basis_*`). */
export function basisWords(basis: AskBasis): string {
  switch (basis) {
    case "REGISTER":
      return strings.ask_basis_register;
    case "SCHEDULES":
      return strings.ask_basis_schedules;
    case "NOTES":
      return strings.ask_basis_notes;
    case "LEVELS":
      return strings.ask_basis_levels;
    case "TEXT":
      return strings.ask_basis_text;
    case "SHEETS":
      return strings.ask_basis_sheets;
  }
}

/** The screen each of this area's refusals sends a reader to, and the words its link says (§3). */
export function refusalEvidence(code: string, tenantId: string, projectId: string): { href: string; label: string } {
  const project = `/t/${tenantId}/p/${projectId}`;
  switch (code) {
    case "ASK_NOT_MEASURED":
      return { href: `${project}/takeoff/coverage`, label: strings.ask_evidence_coverage };
    case "ASK_ESTIMATE_NOT_BUILT":
      return { href: `${project}/takeoff/boq`, label: strings.ask_evidence_boq };
    case "ASK_JUDGEMENT_NOT_OFFERED":
      return { href: `${project}/takeoff/schedules`, label: strings.ask_evidence_schedules };
    case "PERMISSION_NOT_HELD":
      return { href: `${project}/settings/participants`, label: strings.ask_denied_evidence };
    default:
      return { href: originAddress(tenantId, projectId, null), label: strings.ask_evidence_register };
  }
}

/** Whether an answered question rests on less than everything under it — the article's `partial` (I-399). */
export function isPartial(answer: AskAnswer): boolean {
  return answer.outcome === "ANSWERED" && answer.facts.partial !== null;
}
