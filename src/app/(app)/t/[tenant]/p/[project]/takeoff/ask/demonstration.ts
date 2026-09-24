// The evidence instrument's demonstration of S-Ask (`?__state=`, `src/app/theme-resolver.ts`).
//
// R-UI-050 rules the seven cells and the Decision §2 rules each one; a cell only a test runner can
// reach is a cell nobody can review. This file answers, for a state asked for by name, the props that
// stand the SCREEN ITSELF in that state — the same presenter, the same renderers, the same derivation
// — over a kept thread of the state named, exactly as `../boq/demonstration.ts` does for the draft.
//
// The answers are the engine's own shape (`AskAnswer`), stated here as facts; the sentences a reviewer
// reads are the presenter's, from the one string table, so nothing on the page is transcribed.
import { REFUSALS } from "@/core/errors";
import type { AskAnswer, AskFacts, AskPlace, AskReading } from "@/modules/takeoff/ask/law";
import type { AskArrivalView, AskDemonstration } from "./ask-screen";
import { ASK_STATES, type AskState } from "./states";
import type { KeptAnswer } from "./thread";

/** What a demonstration hands the screen beside the thread. */
export type Demonstrated = {
  readonly demonstration: AskDemonstration;
  readonly arrival: AskArrivalView | null;
  readonly participant: boolean;
  readonly reportId: string | null;
};

/** The demonstration's own campaign — named as what it is, so no reader mistakes it for a reading. */
const CAMPAIGN = Object.freeze({ campaignId: "00000000-0000-4000-8000-00000000a500", setRevisionId: "00000000-0000-4000-8000-00000000a501" });
const DRAWING_ID = "00000000-0000-4000-8000-00000000a502";

/** The report id the error cell quotes, in the shape a fault seam mints one. */
const REPORT_ID = "00000000-0000-4000-8000-00000000a503";

/** The stamp every kept answer of the demonstration was read at — the page's own, so none is stale. */
const STAMP = "demonstration";

/** The instant the demonstration's answers were asked at. */
const ASKED_AT = "2026-09-24T06:00:00.000Z";

/** Where the demonstrated members stand: one sheet, its members' outlines and marks. */
const PLACE: AskPlace = { drawingId: DRAWING_ID, layoutName: "S-10", sheetLabel: "S-10", keys: ["DXF_HANDLE:2A1", "DXF_HANDLE:2A2"] };

const READING: AskReading = { intent: "COUNT", class: "column", kind: null, mark: "C1", level: "GF", by: null, noteKind: null, discipline: null, unitAsked: null };
const QUANTITY: AskReading = { ...READING, intent: "QUANTITY", kind: "rcc.concrete", mark: null, level: null };

const NO_RECORDS: AskFacts["records"] = { lines: [], objects: [], readings: [], cells: [], sheets: [] };

/** "How many C1 columns are on GF?" — one column, on one sheet. */
const COUNTED: AskAnswer = {
  outcome: "ANSWERED",
  routedBy: "GRAMMAR",
  reading: READING,
  followUp: false,
  facts: {
    statement: { intent: "COUNT", count: { value: "1", unit: null, kind: null, places: 0, at: [PLACE] }, struck: 0, typical: null },
    partial: null,
    places: [PLACE],
    records: { ...NO_RECORDS, objects: [{ objectKey: "column/GF/C1", level: "GF", class: "column", mark: "C1", sourceKey: "p:DXF_HANDLE:2A0:C1", place: PLACE }] },
    basis: "REGISTER",
  },
};

/** "What is the column concrete?" — three complete lines, one column registered with no line. */
const MEASURED: AskAnswer = {
  outcome: "ANSWERED",
  routedBy: "GRAMMAR",
  reading: QUANTITY,
  followUp: false,
  facts: {
    statement: { intent: "QUANTITY", figure: { value: "1.215", unit: "m3", kind: "rcc.concrete", places: 3, at: [PLACE] }, lines: 3, breakdown: null, apart: null },
    partial: { lines: 0, codes: [], objects: 1, reasons: [{ code: REFUSALS.INTERPRETED_UNCORROBORATED.code, count: 1, variables: [] }] },
    places: [PLACE],
    records: NO_RECORDS,
    basis: "REGISTER",
  },
};

/** "What will the column concrete cost?" — refused by name. */
const PRICED: AskAnswer = { outcome: "REFUSED", code: "ASK_ESTIMATE_NOT_BUILT", reading: null, held: null };

function kept(id: string, question: string, answer: AskAnswer): KeptAnswer {
  return { id, question, askedAt: ASKED_AT, stamp: STAMP, answer, refusal: null, fault: null, previous: null, declined: false };
}

const THREAD_READY: readonly KeptAnswer[] = [kept("a", "How many C1 columns are on GF?", COUNTED)];
const THREAD_PARTIAL: readonly KeptAnswer[] = [kept("b", "What is the column concrete?", MEASURED), ...THREAD_READY];
const THREAD_REFUSED: readonly KeptAnswer[] = [kept("c", "What will the column concrete cost?", PRICED), ...THREAD_READY];

const ARRIVAL: AskArrivalView = { campaign: CAMPAIGN, stamp: STAMP, example: { class: "column", mark: "C1", level: "GF" } };

/**
 * The two cells R-UI-050 names differently from this screen's own roster: a reviewer's instrument
 * asks by the MATRIX's name, so both spellings open the same cell (the draft BOQ's precedent).
 */
const CELL_NAMES: Readonly<Record<string, string>> = Object.freeze({ refusal: "refused", "permission-denied": "denied" });

function standing(state: AskState | null, thread: readonly KeptAnswer[], extra: Partial<Demonstrated> = {}, offline = false): Demonstrated {
  return { demonstration: { state, thread, offline }, arrival: ARRIVAL, participant: true, reportId: null, ...extra };
}

/**
 * The props that stand this screen in the state an address asked for, or null for a name the screen
 * never declared — the page then reads the ordinary screen rather than paint a state nobody named.
 */
export function demonstrationOf(asked: string): Demonstrated | null {
  const state = ASK_STATES.find((name): name is AskState => name === (CELL_NAMES[asked] ?? asked));
  switch (state) {
    case "loading":
      return standing("loading", []);
    case "denied":
      return standing(null, [], { participant: false, arrival: null });
    case "offline":
      return standing(null, THREAD_READY, {}, true);
    case "error":
      return standing(null, [], { reportId: REPORT_ID, arrival: null });
    case "refused":
      return standing(null, THREAD_REFUSED);
    case "empty":
      return standing(null, []);
    case "partial":
      return standing(null, THREAD_PARTIAL);
    case "ready":
      return standing(null, THREAD_READY);
    default:
      return null;
  }
}
