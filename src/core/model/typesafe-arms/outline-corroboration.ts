// The outline's corroboration, as Jev is asked it (L-QTY-04, R-TO-051, L-AI-01): ONE Noul over one
// state of fifteen named fields — "the outline corroborates the sighting" — on the request
// `@/core/outline-corroboration` composes.
//
// A Noul, not a choice: there is no list to pick from and nothing to generate. Every figure the
// question reasons over is found by code before the call, and what comes back is the single
// probability that this outline is the member its mark names at the size the drawing states for it
// (docs.typesafe.ai/primitives/noul, read 2026-09-22: "A Noul value runs from 0 to 1, but it's not a
// scale of the thing you asked about. It is the probability that the answer is yes."). Criteria are
// optional for a Noul and the boundaries here are the numbers in the state rather than a distinction
// words would sharpen, so the question carries its whole meaning in its own instructions and states
// none.
//
// The seam reads a `noul` as the answer's VALUE and states no confidence for it — the docs state
// "There is no separate `confidence` value for a Noul, unlike a Choice or a Score" (7689a117) — so
// the ledger records the probability whole as the answer's value, the call's confidence is null, and
// the calibration line counts this question's judged calls with `confidenceStated` at zero rather
// than averaging a probability as if it were a confidence.
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the corroboration request builder spells, sorted — what this arm is recognised by. */
const OUTLINE_KEYS = [
  "class",
  "footprintMax",
  "footprintMin",
  "gridSpacing",
  "mark",
  "markKey",
  "nearAnchorDistance",
  "nearAnchorReach",
  "outlineArea",
  "outlineKey",
  "outlineLongest",
  "outlineShorter",
  "planMedianLongest",
  "statedLongest",
  "statedShorter",
] as const;

/** The one question posted, by the id the answers come back under. */
const QUESTION_ID = "outline_corroborates";

/** One interpreted outline and the sighting it may corroborate, as recognised on a request. */
export type OutlineTask = {
  kind: "outline";
  /** The request's own canonical content, put as the state it already is (docs: named fields). */
  state: Record<string, JsonValue>;
  outlineKey: string;
  markKey: string;
};

/**
 * What the model is asked, whole. Every field is named by its backticked path, as the docs ask, and
 * the sentence says what a yes and a no each mean — a Noul's boundary is stated in its instructions
 * or it is not stated at all.
 */
const INSTRUCTIONS = [
  "`outlineLongest`, `outlineShorter` and `outlineArea` describe the bounding box of one closed outline drawn on a layout plan of a structural construction drawing, in the drawing's own units.",
  "`mark` is the member mark standing nearest that outline and `class` is the kind of member that mark names.",
  "`statedLongest` and `statedShorter` are the section the drawing's own schedule states for that mark, converted into the same drawing units at the scale the drawing's plans and schedules agree on; each is null where the schedule states no such side for the mark, and both are null where it states no section for it at all.",
  "`planMedianLongest` is the median longest side of every mark-anchored outline this same plan places.",
  "`nearAnchorDistance` is how far that mark stands from the outline's centre, and `nearAnchorReach` is the furthest a mark may stand from an outline and still be taken to name it; `gridSpacing` is the plan's minimum grid spacing, which both distances are scaled from.",
  "`footprintMin` and `footprintMax` are the band, as shares, inside which a member of this plan is expected to fall against `planMedianLongest` and against the stated section.",
  "Is this outline the member that `mark` names, at the size this drawing states for it?",
  "Answer yes where the outline's size agrees with the stated section and with the plan's own other members inside the band, and the mark stands well within the near-anchor reach.",
  "Answer no where the outline is better explained as something else the plan drew near that mark — a stair or lift opening, a room or parapet ring, a hatch fragment, or a different member the mark merely stands close to.",
].join(" ");

/**
 * The corroboration's arm: one Noul, and the two keys the answer cites.
 *
 * The citations are CODE's, not the model's: a Noul selects no candidate, so L-AI-02's "cites a
 * candidate's own key" is honoured by this arm naming the two entities the judgment is about — the
 * outline and the mark of the very request — exactly as the view caption's arm cites the caption's
 * own entity. A request that names neither is refused before anything is posted rather than
 * answering a proposal nothing could resolve.
 */
export const outlineCorroborationArm: TypeSafeArm<OutlineTask> = {
  question: MODEL_QUESTIONS.outlineCorroboration,
  keys: OUTLINE_KEYS,

  recognise(record): OutlineTask | null {
    const { outlineKey, markKey } = record;
    if (typeof outlineKey !== "string" || typeof markKey !== "string") return null;
    // The state is the request's own content, passed through as the named object it already is
    // (docs.typesafe.ai/concepts/state: "named fields that clarify relationships"). Nothing is
    // renamed, reordered or dropped on the way to Jev, so what was hashed is what was asked.
    const state: Record<string, JsonValue> = {};
    for (const key of OUTLINE_KEYS) {
      const held = record[key];
      if (!isJson(held)) return null;
      state[key] = held;
    }
    return { kind: "outline", state, outlineKey, markKey };
  },

  guard(task): void {
    if (task.outlineKey === "" || task.markKey === "") {
      throw new Error("a corroboration is about one outline and the mark that anchors it, and this request names no key for one of them; no question was posted");
    }
  },

  compose(task): TypeSafeQuestion {
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      state: task.state,
      questions: { [QUESTION_ID]: { type: "noul", instructions: INSTRUCTIONS } },
    };
    return {
      body,
      read(answers) {
        // Nothing is supplied where Jev supplied nothing (L-AI-02): a `noul` that is not a finite
        // number is carried as null, and the caller's decoder refuses the reading as MALFORMED.
        return { payload: { corroborates: noulOf(answers[QUESTION_ID]) }, sources: [...new Set([task.outlineKey, task.markKey])] };
      },
    };
  },
};

/** The `noul` of one answer, as Jev spelled it, or null where it gave no figure. */
function noulOf(answer: unknown): number | null {
  if (answer === null || typeof answer !== "object") return null;
  const noul = (answer as { noul?: unknown }).noul;
  return typeof noul === "number" && Number.isFinite(noul) ? noul : null;
}

/** Whether a value read off the request is one the state may carry — a string, a finite number, or null. */
function isJson(value: unknown): value is JsonValue {
  return value === null || typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

/** The key set and the question id, published for the test that puts a recorded request through this arm. */
export { OUTLINE_KEYS, QUESTION_ID as OUTLINE_QUESTION_ID };
