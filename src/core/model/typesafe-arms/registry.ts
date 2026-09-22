// The arms, enumerated (AM-11). This file ENUMERATES and never re-declares: every question's key
// set, instructions, criteria and reading live in that question's own file, and a question added to
// the product is one new file beside them plus one line here — the import that names it and the
// entry that admits it. `./registry.test.ts` carries the duplicate-key test the law asks for.
import type { TypeSafeArm } from "./arm";
import { boqLineDescriptionArm } from "./boq-line-description";
import { coverageCauseArm } from "./coverage-cause";
import { noteClauseArm } from "./note-clause";
import { outlineCorroborationArm } from "./outline-corroboration";
import { scheduleCellArm } from "./schedule-cell";
import { sheetReadingArm } from "./sheet-reading";
import { sheetRevisionRecencyArm } from "./sheet-revision-recency";
import { viewCaptionArm } from "./view-caption";

/** The roster, in the order a request is matched against it. One line per question, and no more. */
export const TYPESAFE_ARMS = [
  sheetReadingArm,
  viewCaptionArm,
  scheduleCellArm,
  noteClauseArm,
  coverageCauseArm,
  boqLineDescriptionArm,
  outlineCorroborationArm,
  sheetRevisionRecencyArm,
] as const;

/** The task of one arm, read off its own recognition. */
type TaskOf<A> = A extends TypeSafeArm<infer Task> ? Task : never;

/**
 * The closed questions this adapter can put to Jev, as recognised on a request — derived from the
 * roster above rather than restated, so an arm added there widens this union by itself (B-19).
 */
export type TypeSafeTask = TaskOf<(typeof TYPESAFE_ARMS)[number]>;
