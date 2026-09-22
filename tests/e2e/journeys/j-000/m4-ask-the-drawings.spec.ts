/**
 * J-000 SEGMENTS: ask the drawings a question
 *
 * MISSING DOOR: S-Ask has no Design Decision, so by C-13 the screen is not ready to build; the ai router holds no procedure; the live model, TypeSafe Jev, answers closed questions and generates no text, so an ask needs a new closed-question design over the register — the query chosen from a closed roster, its slots from candidates code finds, every number written by the formatter; and verify replays only recorded answers (L-AI-01), which nobody has recorded.
 *
 * The fourth of AM-17's M4 segments — AM-09 §3's "a question asked of the drawings", X-7 — declared
 * before the milestone lands, in its own file since session 7 split the leg one file per segment.
 *
 * THE MEASURED WORK BEHIND EACH DOOR.
 * 1. No Design Decision. docs/design/ holds no s-ask.md. S-Ask is "a conversational panel with cited
 *    answers" (docs/specs/cubit.bible.xml:637), and X-7 wants "every number in it clickable back to a
 *    sheet or a row" (:662).
 * 2. No door. src/server/routers/ai.ts:5 is `router({})`. The procedure lands there through
 *    authorize() with its live-database refusal, and a question that cannot be answered refuses with a
 *    registered reason (J-043, :754).
 * 3. No question. MODEL_QUESTIONS (src/core/model/questions.ts:11-28) is eight closed questions and none
 *    is an ask. Where the TypeSafe key is set the live transport is Jev, "closed questions, no
 *    generation" (src/core/model/live.ts:1-4; src/core/model/typesafe.ts:3, "Jev does not generate
 *    text"). R-AI-003's "the model composes the answer from tool results" (:558) is therefore read as a
 *    closed choice — which query, which mark, which level — with the formatter rendering every number:
 *    an Interpretation to record before the first answer, not a Deviation.
 * 4. No recording. The journey lane hands every process the fixture root (tests/e2e/support/
 *    journey-env.ts:40-48), and a request with no recorded answer refuses FIXTURE_MISSING
 *    (src/core/model/fixture.ts:23,37), never a network call. The recorder is run "ON PURPOSE" by "a
 *    person with the TypeSafe key" (scripts/model-corpus.ts:2-4), and no session has web access — so
 *    until the owner records a fixture for each question the leg asks, the leg cannot be walked at all.
 *
 * THE LAW THAT FORCES IT. C-13 (cubit.bible.xml:800). L-AI-01 (:263): one path, replayed from
 * fixtures inside verify, a missing fixture is FIXTURE_MISSING. L-AI-03 (:265): the model may "answer
 * questions with citations" and never writes a register row, a rate, a signature or an act. R-AI-003
 * (:558): every number in an answer is a query result rendered by the formatter.
 *
 * HONEST SIZE. M to L once the owner records: s-ask.md; an ask-intent closed question with its Jev arm;
 * a deterministic executor over the register and a formatter citing through IdChip; the ai procedure
 * through authorize(); a refusal code for the unanswerable; one recorded fixture per J-000 question.
 * Without the recording no size of work walks it honestly.
 *
 * The increment that lands these doors deletes this fixme and its line in
 * tests/journeys/fixme-roster.test.ts and writes the walk here; it never deletes the file (AM-09 §3,
 * AM-17).
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M4's question of the drawings (AM-09 §3, AM-17), owed", () => {
  test.fixme("MISSING DOOR: J-000 m4-ask-the-drawings: S-Ask has no Design Decision (C-13), the ai router holds no procedure, Jev answers closed questions only so an ask needs a closed-question design over the register, and verify replays recorded answers nobody has recorded (L-AI-01)", () => {
    // AM-09 §3, AM-17: the walk lands with its doors; until then the leg is declared, collected and impossible to forget.
  });
});
