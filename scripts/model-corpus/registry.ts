// The recorders, enumerated (AM-11). This file ENUMERATES and never re-declares: which state a
// question is recorded over, which flags it reads and how its subjects are spelled all live in that
// question's own file. A question added to the product is one new file beside them plus one line
// here — and because the roster is keyed by `ModelQuestion`, a name added to `MODEL_QUESTIONS` with
// no recorder beside it does not compile.
import { MODEL_QUESTIONS, type ModelQuestion } from "../../src/core/model";
import { subjectsOf as boqLineDescription } from "./boq-line-description";
import { subjectsOf as coverageCause } from "./coverage-cause";
import { subjectsOf as noteClause } from "./note-clause";
import { subjectsOf as outlineCorroboration } from "./outline-corroboration";
import { subjectsOf as scheduleCell } from "./schedule-cell";
import { subjectsOf as sheetReading } from "./sheet-reading";
import { subjectsOf as sheetRevisionRecency } from "./sheet-revision-recency";
import { subjectsOf as viewCaption } from "./view-caption";
import type { CorpusRecorder } from "./recorder";

/** Every question's recorder, by the name the ledger and the roster file it under. */
export const CORPUS_RECORDERS: Readonly<Record<ModelQuestion, CorpusRecorder>> = Object.freeze({
  [MODEL_QUESTIONS.sheetReading]: sheetReading,
  [MODEL_QUESTIONS.viewCaption]: viewCaption,
  [MODEL_QUESTIONS.scheduleCell]: scheduleCell,
  [MODEL_QUESTIONS.noteClause]: noteClause,
  [MODEL_QUESTIONS.coverageCause]: coverageCause,
  [MODEL_QUESTIONS.boqLineDescription]: boqLineDescription,
  [MODEL_QUESTIONS.outlineCorroboration]: outlineCorroboration,
  [MODEL_QUESTIONS.sheetRevisionRecency]: sheetRevisionRecency,
});
