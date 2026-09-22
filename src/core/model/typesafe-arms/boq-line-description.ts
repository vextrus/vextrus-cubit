// The boq-line-description question's arm (L-BD-01, L-MEA-04, L-AI-01). A STUB until its increment
// lands: the registry holds its line so the roster and the recorder compile, the key set below is
// the one its request builder will spell, and a request wearing it is recognised as nothing — the
// seam throws "no question was posted" rather than posting a question nobody has spelled (B-14).
import { MODEL_QUESTIONS } from "../questions";
import type { TypeSafeArm, TypeSafeQuestion } from "./arm";

/** The key set the description request builder spells, sorted — what this arm is recognised by. */
const DESCRIPTION_KEYS = ["attributes", "candidates", "keys", "line"] as const;

/** One measured BOQ line, as recognised on a request. */
export type DescriptionTask = { kind: "description" };

export const boqLineDescriptionArm: TypeSafeArm<DescriptionTask> = {
  question: MODEL_QUESTIONS.boqLineDescription,
  keys: DESCRIPTION_KEYS,
  recognise(): DescriptionTask | null {
    return null;
  },
  compose(): TypeSafeQuestion {
    throw new Error("boq-line-description is named but not yet spelled: no question was posted");
  },
};
