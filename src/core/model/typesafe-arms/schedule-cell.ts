// The schedule-cell question's arm (R-TO-031, L-CAD-08, L-AI-01). A STUB until its increment lands:
// the registry holds its line so the roster and the recorder compile, the key set below is the one
// its request builder will spell, and a request wearing it is recognised as nothing — the seam
// throws "no question was posted" rather than posting a question nobody has spelled (B-14).
import { MODEL_QUESTIONS } from "../questions";
import type { TypeSafeArm, TypeSafeQuestion } from "./arm";

/** The key set the schedule-cell request builder spells, sorted — what this arm is recognised by. */
const CELL_KEYS = ["cells", "columns", "row", "title"] as const;

/** One contested schedule row, as recognised on a request. */
export type CellTask = { kind: "cell" };

export const scheduleCellArm: TypeSafeArm<CellTask> = {
  question: MODEL_QUESTIONS.scheduleCell,
  keys: CELL_KEYS,
  recognise(): CellTask | null {
    return null;
  },
  compose(): TypeSafeQuestion {
    throw new Error("schedule-cell is named but not yet spelled: no question was posted");
  },
};
