// S-Ask's refusals (R-AI-003, J-043, docs/design/s-ask.md §3): the five ways a question put to the
// drawings is answered with no answer, each by name. Refusing a question is not a fault of anybody's:
// every entry is `info` and renders inline, in the answer's own place in the thread.
//
// The model seam's own refusals (`FIXTURE_MISSING`, `MALFORMED`, `UNSOURCED`, `SOURCE_UNRESOLVED`)
// are `./ai.ts`'s and stay there — a question the machine was asked to route and could not is
// answered with the code the seam answered, never re-worded here (R-SPINE-062: one code, one meaning).

import type { RefusalGroup } from "./law";

/** Every code this area registers. The barrel folds this union into `RefusalCode` (B-19). */
export type AskRefusalCode =
  | "ASK_NOT_UNDERSTOOD"
  | "ASK_SUBJECT_UNKNOWN"
  | "ASK_NOT_MEASURED"
  | "ASK_ESTIMATE_NOT_BUILT"
  | "ASK_JUDGEMENT_NOT_OFFERED";

/** This area's registered refusals, frozen entry by entry exactly as the one register holds them. */
export const ASK_REFUSALS: RefusalGroup<AskRefusalCode> = Object.freeze({
  // No intent of the closed roster fired, or the person declined every reading offered: the
  // question is not guessed at (I-396).
  ASK_NOT_UNDERSTOOD: Object.freeze({
    code: "ASK_NOT_UNDERSTOOD",
    message: "This question could not be read as one the register, the schedules, the notes or the sheet text can answer.",
    remedy: "Ask again naming what you want counted, measured or found — a class, a mark, a level, a note, a schedule or a sheet.",
    severity: "info",
    surface: "inline",
  }),
  // A mark, a level, a sheet, a schedule or a note kind the project does not hold: the answer lists
  // what it does hold beneath the refusal, and never substitutes a near one (I-400).
  ASK_SUBJECT_UNKNOWN: Object.freeze({
    code: "ASK_SUBJECT_UNKNOWN",
    message: "This question names a mark, level, sheet, schedule or note these drawings do not hold.",
    remedy: "Ask again with one they hold — they are listed beneath this answer.",
    severity: "info",
    surface: "inline",
  }),
  // The campaign holds no line for what was asked — a class nothing measured, or no campaign at all.
  // Under-measurement is a disclosure, never a zero (L-QTY-02, I-399).
  ASK_NOT_MEASURED: Object.freeze({
    code: "ASK_NOT_MEASURED",
    message: "Nothing is measured for what this question asks about: the campaign holds no line for it.",
    remedy: "Measure the campaign from the register, or see in the coverage grid which classes are not measured yet.",
    severity: "info",
    surface: "inline",
  }),
  // Rates, prices, costs, money and time: the estimate is M6's, so there is no figure to give, and a
  // quantity is never answered in its place (§1.2's refusal cues).
  ASK_ESTIMATE_NOT_BUILT: Object.freeze({
    code: "ASK_ESTIMATE_NOT_BUILT",
    message: "Rates, prices and costs are not part of this product yet, so there is no figure to give.",
    remedy: "Ask about quantities, counts and what the drawings state; the draft BOQ lists the measured items unpriced.",
    severity: "info",
    surface: "inline",
  }),
  // Whether a design is safe, adequate or compliant is the engineer's judgement, never the
  // product's (L-AI-03): the question is declined by name, and what the drawings state is offered.
  ASK_JUDGEMENT_NOT_OFFERED: Object.freeze({
    code: "ASK_JUDGEMENT_NOT_OFFERED",
    message: "Whether a design is adequate, safe or compliant is the engineer's judgement, and the product does not offer one.",
    remedy: "Ask what the drawings state — a size, a strength, a lap, a level — and the answer shows where they state it.",
    severity: "info",
    surface: "inline",
  }),
});
