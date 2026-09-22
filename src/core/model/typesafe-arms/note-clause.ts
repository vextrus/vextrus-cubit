// The note-clause question's arm (R-TO-034, L-AI-01). A STUB until its increment lands: the
// registry holds its line so the roster and the recorder compile, the key set below is the one its
// request builder will spell, and a request wearing it is recognised as nothing — the seam throws
// "no question was posted" rather than posting a question nobody has spelled (B-14).
import { MODEL_QUESTIONS } from "../questions";
import type { TypeSafeArm, TypeSafeQuestion } from "./arm";

/** The key set the note-clause request builder spells, sorted — what this arm is recognised by. */
const CLAUSE_KEYS = ["clause", "figures", "lapTable", "layout"] as const;

/** One general-note clause, as recognised on a request. */
export type ClauseTask = { kind: "clause" };

export const noteClauseArm: TypeSafeArm<ClauseTask> = {
  question: MODEL_QUESTIONS.noteClause,
  keys: CLAUSE_KEYS,
  recognise(): ClauseTask | null {
    return null;
  },
  compose(): TypeSafeQuestion {
    throw new Error("note-clause is named but not yet spelled: no question was posted");
  },
};
