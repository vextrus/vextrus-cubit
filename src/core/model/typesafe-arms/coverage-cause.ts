// The coverage-cause question's arm (R-TO-052, L-QTY-04, L-AI-01). A STUB until its increment
// lands: the registry holds its line so the roster and the recorder compile, the key set below is
// the one its request builder will spell, and a request wearing it is recognised as nothing — the
// seam throws "no question was posted" rather than posting a question nobody has spelled (B-14).
import { MODEL_QUESTIONS } from "../questions";
import type { TypeSafeArm, TypeSafeQuestion } from "./arm";

/** The key set the coverage-cause request builder spells, sorted — what this arm is recognised by. */
const CAUSE_KEYS = ["cell", "key", "observations", "sightings"] as const;

/** One unmeasured cell of the residue, as recognised on a request. */
export type CauseTask = { kind: "cause" };

export const coverageCauseArm: TypeSafeArm<CauseTask> = {
  question: MODEL_QUESTIONS.coverageCause,
  keys: CAUSE_KEYS,
  recognise(): CauseTask | null {
    return null;
  },
  compose(): TypeSafeQuestion {
    throw new Error("coverage-cause is named but not yet spelled: no question was posted");
  },
};
