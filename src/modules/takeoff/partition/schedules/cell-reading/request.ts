// R-TO-031's contested-cell question: what a model may be asked about one row of a reconstructed
// schedule, and nothing more (L-AI-01, L-AI-03).
//
// Pure and total over the stored table and the row: the same drawing makes the same request forever,
// so the hash a recorded answer is filed under is a fact about the drawing rather than about the run
// (L-AI-01 replays deterministically from the corpus).
//
// It lives in the takeoff module rather than in core because the candidates are the notation
// grammar's, and the grammar is `../../notation` — ARCH-01 lets core name neither it nor this. The
// view-caption question sits in core only because a second module publishes it; nothing publishes
// this one but the partition that finds the cells.
import { MODEL_QUESTIONS, canonicalJson, type ModelRequest } from "@/core/model";
import type { ModelId } from "@/core/model-ledger.types";
import type { CellReadingState } from "./candidates";

/** Any JSON value — what a transport carries, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a contested cell is read by. AS-05 pins the reading-and-proposal work to this id, and a
 * schedule cell is a READING of the drawing — which of the grammar's own candidates the draughtsman
 * meant, against the table around it — rather than a one-word class.
 *
 * Jev is billed under this pinned id until the owner's amendment lands
 * (docs/decisions/as-05-jev-amendment.md): nothing here adds Jev to AS-05 or invents a rate.
 */
export const CELL_READING_MODEL: ModelId = "claude-opus-5";

/**
 * What the model is told it is doing. It states the answer's exact shape and the citation rule,
 * because L-AI-02 refuses an answer that is neither — an uncited answer is UNSOURCED and a citation
 * naming anything but this row's own texts is SOURCE_UNRESOLVED, and a model that was not told so
 * would spend a tenant's tokens on answers nobody can accept.
 */
const SYSTEM = [
  "You read one row of a schedule table reconstructed from a Bangladeshi structural construction drawing.",
  "The deterministic notation grammar has already read every cell it could. You are asked only about the cells it could not settle, and only ever to CHOOSE among the readings that grammar itself found in those cells' own words.",
  'Answer with a JSON object of exactly {"payload": {...}, "sources": [...]}.',
  "`payload` names exactly two fields: `header` (the probability you gave the row-heading judgment, or null) and `cells` (an array, one entry per contested cell you read, each naming `column`, `attribute`, `text` and `sourceKeys` taken from the candidate you chose).",
  "`sources` is a non-empty array of the source keys you read the answer out of: the row's own keys, and the keys of every candidate you chose. Cite nothing else.",
  "Propose a reading. Do not conclude, do not measure, and never supply a section, a bar, a spacing or a band the drawing did not write — where a cell states no attribute of the member, say so with the no-match outcome rather than choosing the nearest candidate.",
].join("\n");

/**
 * The question one contested row is asked. The content's top-level keys are exactly `cells`,
 * `columns`, `row` and `title` — the key set the TypeSafe adapter recognises this question by — and
 * `cells` is an OBJECT keyed by the column index as a string, so the question's own instructions can
 * name the state by the backticked field paths it is actually carried under (`cells.2.candidates`).
 */
export function scheduleCellRequest(state: CellReadingState): ModelRequest {
  return {
    modelId: CELL_READING_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson(contentOf(state)) }],
    question: MODEL_QUESTIONS.scheduleCell,
  };
}

/**
 * The row as plain JSON: the reader's own types spelled out field by field, so what travels is what
 * this file says travels. A structure widened to JSON by assertion would carry whatever a later
 * field of `CellReadingState` grew — and the hash a recorded answer is filed under would move with
 * it, silently (L-AI-01).
 */
function contentOf(state: CellReadingState): JsonValue {
  return {
    cells: Object.fromEntries(
      Object.entries(state.cells).map(([at, cell]) => [
        at,
        {
          columnIndex: cell.columnIndex,
          text: cell.text,
          header: cell.header,
          candidates: cell.candidates.map((candidate) => ({
            id: candidate.id,
            attribute: candidate.attribute,
            means: candidate.means,
            text: candidate.text,
            sourceKeys: [...candidate.sourceKeys],
          })),
        },
      ]),
    ),
    columns: state.columns.map((column) => ({ index: column.index, header: column.header })),
    row: { index: state.row.index, texts: [...state.row.texts], sourceKeys: [...state.row.sourceKeys] },
    title: state.title,
  };
}
