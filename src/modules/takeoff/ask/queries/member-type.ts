// MEMBER_TYPE (§1.2): "What size is C4?" — the rows of the pinned revision's schedules that name the
// mark, each cell quoted as drawn under its column's header, each an EvidenceLink to the texts it was
// read off (I-401). A schedule's row is never read as a quantity (L-CAD-08): this states what the
// drawing wrote, and nothing is counted from it. A mark no schedule names is a subject these drawings
// do not state, listed beneath the refusal with the marks they do.
import { ASK_REFUSAL_CODES, type AskCellRecord, type AskReading, type AskSchedule, type AskScheduleRowFacts, type AskSources } from "../law";
import { compact } from "../grammar";
import { marksInOrder, placesFrom, NO_RECORDS } from "./common";
import type { AskQuery } from "./registry-law";

/** The words of a cell, as whole tokens: `C2 GF TO 2ND:` names C2; `PC3` does not name C3. */
function namesMark(text: string, mark: string): boolean {
  const wanted = compact(mark);
  return text.split(/[^A-Za-z0-9]+/u).some((token) => token.length > 0 && compact(token) === wanted);
}

/** One cell as the answer quotes it, under its header, where its first text stands. */
function cellOf(schedule: AskSchedule, rowIndex: number, cell: AskSchedule["rows"][number]["cells"][number], sources: AskSources): AskCellRecord {
  const header = schedule.header?.cells.find((one) => one.columnIndex === cell.columnIndex)?.text ?? null;
  const first = cell.sourceKeys[0];
  const entity = first === undefined ? null : sources.entityAt(schedule.drawingId, first);
  const place = entity === null || entity.layoutName === null ? null : { drawingId: schedule.drawingId, layoutName: entity.layoutName, sheetLabel: entity.sheetLabel, keys: [...cell.sourceKeys] };
  return { scheduleKey: schedule.scheduleKey, schedule: schedule.title, rowIndex, column: header, text: cell.text, sourceKeys: cell.sourceKeys, drawingId: schedule.drawingId, place };
}

export const MEMBER_TYPE_QUERY: AskQuery = {
  intent: "MEMBER_TYPE",
  basis: "SCHEDULES",
  needs: ["schedules", "entities"],
  answer(reading: AskReading, sources: AskSources) {
    const mark = reading.mark;
    const rows: AskScheduleRowFacts[] = [];
    if (mark !== null) {
      for (const schedule of sources.schedules) {
        for (const row of schedule.rows) {
          if (!row.cells.some((cell) => namesMark(cell.text, mark))) continue;
          rows.push({ scheduleKey: schedule.scheduleKey, schedule: schedule.title, rowIndex: row.rowIndex, cells: row.cells.map((cell) => cellOf(schedule, row.rowIndex, cell, sources)) });
        }
      }
    }
    if (rows.length === 0) {
      const named = marksInOrder(
        sources.schedules.flatMap((schedule) => schedule.rows.map((row) => row.cells.find((cell) => cell.columnIndex === 0)?.text ?? "")).filter((text) => /^[A-Za-z]{1,4}\d{1,3}[A-Za-z]?$/u.test(text.trim())).map((text) => text.trim()),
      );
      return { outcome: "REFUSED", code: ASK_REFUSAL_CODES.subjectUnknown, reading, held: { subject: "MARKS", class: reading.class, items: named } };
    }
    const cells = rows.flatMap((row) => row.cells);
    return {
      statement: { intent: "MEMBER_TYPE", rows },
      partial: null,
      places: placesFrom(cells.map((cell) => cell.place)),
      records: { ...NO_RECORDS, cells },
      basis: "SCHEDULES",
    };
  },
};
