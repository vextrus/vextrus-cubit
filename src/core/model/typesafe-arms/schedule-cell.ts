// The schedule-cell question's arm (R-TO-031, L-CAD-08, L-AI-01): one `choice` per CONTESTED cell of
// one row, over the candidates the notation grammar found in that cell's own words, and one `noul`
// asking whether the row heads or annotates the table rather than stating a member — asked together
// over one state, which is the fan-out the docs prescribe (independent questions, one request).
//
// The request this arm recognises is the one `@/modules/takeoff/partition/schedules/cell-reading`
// composes. It carries each candidate's own sentence (`means`) with it, so this file spells no
// schedule vocabulary of its own: what a cell may be read AS is the takeoff module's law, core may
// not name it (ARCH-01), and a second spelling here could silently disagree with the roster the
// caller decodes an answer back out of (B-17).
//
// What this arm DOES own is the wire's own no-match outcome: `NOT_STATED`, the answer a cell that
// states no attribute of the member earns. The docs ask a choice that may fit nothing to offer one,
// and it is the adapter's because it is not a reading — it is the absence of one.
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the schedule-cell request builder spells, sorted — what this arm is recognised by. */
const CELL_KEYS = ["cells", "columns", "row", "title"] as const;

/** How long a criterion may be in the question; the whole span is what a chosen candidate answers with. */
const CRITERION_LENGTH = 100;

/** The answer a cell states no attribute of the member with — the choice's no-match outcome. */
const NOT_STATED = "NOT_STATED";

/** What `NOT_STATED` covers, spelled once: everything a schedule writes that is not about the member. */
const NOT_STATED_MEANS =
  "The cell states no attribute of the member: it is a remark, a cross-reference to another sheet or detail, a count, a datum or a level mark, or words this schedule carries for a reader and not for the member";

/** The id the row's own judgment is asked under. */
const ROW_IS_HEADER = "row_is_header";

/** One reading the grammar found in a cell: the span, what it would state, and the words it read. */
type Candidate = { readonly id: string; readonly means: string; readonly text: string; readonly attribute: string; readonly sourceKeys: readonly string[] };

/** One contested cell of the row, as recognised on a request. */
type Cell = { readonly columnIndex: number; readonly text: string; readonly header: string; readonly candidates: readonly Candidate[] };

/** One contested schedule row, as recognised on a request. */
export type CellTask = {
  kind: "cell";
  readonly title: string;
  readonly columns: readonly { readonly index: number; readonly header: string }[];
  readonly row: { readonly index: number; readonly texts: readonly string[]; readonly sourceKeys: readonly string[] };
  readonly cells: readonly Cell[];
};

/**
 * The contested row's arm.
 *
 * Every instruction names the state it reads by its backticked field path, as the docs ask, and
 * carries the whole of its own meaning — the question ids are never sent. The choice offers the
 * no-match outcome because a schedule writes remarks and cross-references in the same columns it
 * writes sections in; the noul offers none, because a statement is judged and a judgment has no
 * third answer.
 */
export const scheduleCellArm: TypeSafeArm<CellTask> = {
  question: MODEL_QUESTIONS.scheduleCell,
  keys: CELL_KEYS,

  recognise(record): CellTask | null {
    const row = rowOf(record["row"]);
    if (row === null) return null;
    const title = record["title"];
    if (typeof title !== "string") return null;
    return { kind: "cell", title, columns: columnsOf(record["columns"]), row, cells: cellsOf(record["cells"]) };
  },

  guard(task): void {
    // A row with nothing contested is a row the deterministic grammar already read: putting it to
    // Jev would spend a tenant's tokens on a question whose answer is already known, and the caller
    // that composed it is at fault, never the product's law (B-14).
    if (task.cells.length === 0) {
      throw new Error(`row ${task.row.index} of ${JSON.stringify(task.title)} carries no contested cell, so Jev has nothing to choose about; no question was posted`);
    }
    if (task.row.sourceKeys.length === 0) {
      throw new Error(`row ${task.row.index} of ${JSON.stringify(task.title)} cites no text of the drawing, so no answer about it could be sourced; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    const state: JsonValue = {
      table_title: task.title,
      columns: task.columns.map((column) => ({ index: column.index, header: column.header })),
      row: { index: task.row.index, texts: [...task.row.texts] },
      cells: Object.fromEntries(
        task.cells.map((cell) => [
          String(cell.columnIndex),
          {
            text: cell.text,
            header: cell.header,
            candidates: Object.fromEntries(cell.candidates.map((candidate) => [candidate.id, { text: candidate.text, states: candidate.means }])),
          },
        ]),
      ),
    };

    const questions: Record<string, JsonValue> = {
      [ROW_IS_HEADER]: {
        type: "noul",
        instructions:
          "`table_title` is the title of one schedule table on a Bangladeshi structural construction drawing, `columns` holds the text each column of that table is headed with in column order, and `row.texts` holds the texts of one row that stands beneath the header band, in the same column order; `row.index` is how many bands below the header band it stands. Judge this statement: this row heads or annotates the table rather than stating one member of it — a band-of-floors header spanning the columns, a repeated column-heading band, a unit line, or a continuation banner such as `CONTD. ON S-18`.",
        criteria: {
          true: "The row's texts head or annotate the table: a band of floors spanning the columns, a repeated heading, a unit line, a note, or a continuation or sheet-reference banner.",
          false: "The row states one member of the schedule: a mark, with the section, bars or spacing carried against it.",
        },
      },
    };
    const offered = new Map<string, Candidate>();
    for (const cell of task.cells) {
      const criteria: Record<string, string> = {};
      for (const candidate of cell.candidates) {
        offered.set(`${cell.columnIndex}\u0000${candidate.id}`, candidate);
        criteria[candidate.id] = `${JSON.stringify(candidate.text)} — ${candidate.means}`.slice(0, CRITERION_LENGTH);
      }
      questions[`cell_${cell.columnIndex}`] = {
        type: "choice",
        instructions: `\`table_title\` is the title of one schedule table on a Bangladeshi structural construction drawing, \`columns\` holds the text each column of that table is headed with in column order, and \`row.texts\` holds the texts of one row of that table in the same order. \`cells.${cell.columnIndex}.text\` is one cell of that row, exactly as the drawing writes it — where the drawing wrote two texts in one cell they stand joined by \`+\`. \`cells.${cell.columnIndex}.header\` is the text the column that cell stands under is headed with, which is blank where the schedule headed it with nothing. \`cells.${cell.columnIndex}.candidates\` holds every reading the deterministic notation grammar could make of that cell's own texts, keyed by candidate id: each candidate names \`text\`, a span of the cell's own words, and \`states\`, the one member attribute that reading would state about the member this row names. Which candidate is what this cell states about that member? Choose exactly one candidate id, or ${NOT_STATED}.`,
        criteria: { ...criteria, [NOT_STATED]: NOT_STATED_MEANS },
      };
    }

    return {
      body: { model: TYPESAFE_MODEL, state, questions },
      read(answers) {
        const cells: JsonValue[] = [];
        const cited: string[] = [...task.row.sourceKeys];
        for (const cell of task.cells) {
          const chosen = choiceOf(answers[`cell_${cell.columnIndex}`]);
          // NOT_STATED, an id this arm never offered, and an answer that never came all contribute
          // NOTHING: nothing is supplied where Jev supplied nothing (L-AI-02).
          const candidate = chosen === null || chosen === NOT_STATED ? undefined : offered.get(`${cell.columnIndex}\u0000${chosen}`);
          if (candidate === undefined) continue;
          cells.push({ column: cell.columnIndex, attribute: candidate.attribute, text: candidate.text, sourceKeys: [...candidate.sourceKeys] });
          cited.push(...candidate.sourceKeys);
        }
        // The row's own keys are always cited, because the row's judgment rests on the row's texts —
        // the caption's arm cites the caption's own key for the same reason.
        return { payload: { header: probabilityOf(answers[ROW_IS_HEADER]), cells }, sources: [...new Set(cited)] };
      },
    };
  },
};

/** The noul's own probability, as the API spells it, or null where it stated none. */
function probabilityOf(answer: unknown): number | null {
  if (answer === null || typeof answer !== "object") return null;
  const stated = (answer as { noul?: unknown }).noul;
  return typeof stated === "number" && Number.isFinite(stated) ? stated : null;
}

/** The row as recognised, or null where the content wears the key set but is not a contested row. */
function rowOf(value: unknown): CellTask["row"] | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { index, texts, sourceKeys } = value as Record<string, unknown>;
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  return { index, texts: stringsOf(texts), sourceKeys: stringsOf(sourceKeys) };
}

/** The header band as recognised, in the order the request spells it. */
function columnsOf(value: unknown): CellTask["columns"] {
  if (!Array.isArray(value)) return [];
  const read: { index: number; header: string }[] = [];
  for (const one of value) {
    if (one === null || typeof one !== "object") continue;
    const { index, header } = one as Record<string, unknown>;
    if (typeof index === "number" && Number.isInteger(index)) read.push({ index, header: typeof header === "string" ? header : "" });
  }
  return read;
}

/** The contested cells as recognised, in ascending column order however the request spelled them. */
function cellsOf(value: unknown): Cell[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const read: Cell[] = [];
  for (const [key, held] of Object.entries(value as Record<string, unknown>)) {
    const columnIndex = Number(key);
    if (!Number.isInteger(columnIndex) || columnIndex < 0) continue;
    if (held === null || typeof held !== "object") continue;
    const { text, header, candidates } = held as Record<string, unknown>;
    if (typeof text !== "string") continue;
    read.push({ columnIndex, text, header: typeof header === "string" ? header : "", candidates: candidatesOf(candidates) });
  }
  return read.sort((left, right) => left.columnIndex - right.columnIndex);
}

/** The candidates of one cell, in the order the code that found them spelled them. */
function candidatesOf(value: unknown): Candidate[] {
  if (!Array.isArray(value)) return [];
  const read: Candidate[] = [];
  for (const one of value) {
    if (one === null || typeof one !== "object") continue;
    const { id, means, text, attribute, sourceKeys } = one as Record<string, unknown>;
    if (typeof id !== "string" || typeof means !== "string" || typeof text !== "string" || typeof attribute !== "string") continue;
    read.push({ id, means, text, attribute, sourceKeys: stringsOf(sourceKeys) });
  }
  return read;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : [];
}
