// The outline-corroboration question's arm (L-QTY-04, R-TO-051, L-AI-01). A STUB until its
// increment lands: the registry holds its line so the roster and the recorder compile, the key set
// below is the one its request builder will spell, and a request wearing it is recognised as
// nothing — the seam throws "no question was posted" rather than posting a question nobody has
// spelled (B-14).
import { MODEL_QUESTIONS } from "../questions";
import type { TypeSafeArm, TypeSafeQuestion } from "./arm";

/** The key set the corroboration request builder spells, sorted — what this arm is recognised by. */
const OUTLINE_KEYS = ["class", "mark", "outline", "stated"] as const;

/** One interpreted outline and the sighting it may corroborate, as recognised on a request. */
export type OutlineTask = { kind: "outline" };

export const outlineCorroborationArm: TypeSafeArm<OutlineTask> = {
  question: MODEL_QUESTIONS.outlineCorroboration,
  keys: OUTLINE_KEYS,
  recognise(): OutlineTask | null {
    return null;
  },
  compose(): TypeSafeQuestion {
    throw new Error("outline-corroboration is named but not yet spelled: no question was posted");
  },
};
