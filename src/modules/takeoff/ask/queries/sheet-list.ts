// SHEET_LIST (§1.2): "Which sheets are in the set?" — the sheets of the pinned revision, each named by
// the number and title its title block states and its discipline, optionally of one discipline. Each
// sheet is an EvidenceLink to the layout itself, selecting nothing.
import type { AskReading, AskSources } from "../law";
import { countFigure, NO_RECORDS } from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

export const SHEET_LIST_QUERY: AskQuery = {
  intent: "SHEET_LIST",
  basis: "SHEETS",
  needs: ["sheets"],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const sheets = sources.sheets.filter((sheet) => reading.discipline === null || sheet.discipline === reading.discipline);
    const places = sheets.map((sheet) => ({ drawingId: sheet.drawingId, layoutName: sheet.layoutName, sheetLabel: sheet.number ?? sheet.layoutName, keys: [] }));
    return {
      statement: { intent: "SHEET_LIST", count: countFigure(sheets.length, []), sheets },
      partial: null,
      places,
      records: { ...NO_RECORDS, sheets },
      basis: "SHEETS",
    };
  },
};
