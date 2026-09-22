// The sheet-revision-recency question's arm (R-TO-004, L-AI-03, L-AI-01). A STUB until its
// increment lands: the registry holds its line so the roster and the recorder compile, the key set
// below is the one its request builder will spell, and a request wearing it is recognised as
// nothing — the seam throws "no question was posted" rather than posting a question nobody has
// spelled (B-14).
import { MODEL_QUESTIONS } from "../questions";
import type { TypeSafeArm, TypeSafeQuestion } from "./arm";

/** The key set the revision request builder spells, sorted — what this arm is recognised by. */
const REVISION_KEYS = ["layout", "revisionMarks", "revisionRows", "setRows"] as const;

/** One sheet's revision evidence beside its set's, as recognised on a request. */
export type RevisionTask = { kind: "revision" };

export const sheetRevisionRecencyArm: TypeSafeArm<RevisionTask> = {
  question: MODEL_QUESTIONS.sheetRevisionRecency,
  keys: REVISION_KEYS,
  recognise(): RevisionTask | null {
    return null;
  },
  compose(): TypeSafeQuestion {
    throw new Error("sheet-revision-recency is named but not yet spelled: no question was posted");
  },
};
