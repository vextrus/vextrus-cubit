/**
 * J-000 SEGMENTS: ask the drawings a question
 *
 * MISSING DOOR: S-Ask is decided (docs/design/s-ask.md, session 8) and not built: the ai router holds no procedure, no grammar reads a question, and no query over the register answers one. The Decision reads the question with the product's grammar first and lets the live model, TypeSafe Jev, route only what the grammar cannot settle, as a closed choice; code writes the answer and the formatter every number (s-ask I-395…c, the first the owner's ruling on session 8's Q4: Jev alone, no Claude composer).
 *
 * The fourth of AM-17's M4 segments — AM-09 §3's "a question asked of the drawings", X-7 — declared
 * before the milestone lands, in its own file since session 7 split the leg one file per segment.
 *
 * THE MEASURED WORK BEHIND EACH DOOR.
 * 1. The Design Decision stands (docs/design/s-ask.md, session 8): S-Ask is "a conversational panel
 *    with cited answers" (docs/specs/cubit.bible.xml:637), read as the lane's seventh tab, and X-7's
 *    "every number in it clickable back to a sheet or a row" (:662) is its I-404. Items 3 and 4
 *    below are what it answered: the closed-choice reading is its I-395…c, and this leg walks
 *    grammar-routed questions only (its §6), so it waits on no recorded model answer.
 * 2. No door. src/server/routers/ai.ts:5 is `router({})`. The procedure lands there through
 *    authorize() with its live-database refusal, and a question that cannot be answered refuses with a
 *    registered reason (J-043, :754).
 * 3. No question. MODEL_QUESTIONS (src/core/model/questions.ts:11-28) is eight closed questions and none
 *    is an ask. Where the TypeSafe key is set the live transport is Jev, "closed questions, no
 *    generation" (src/core/model/live.ts:1-4; src/core/model/typesafe.ts:3, "Jev does not generate
 *    text"). R-AI-003's "the model composes the answer from tool results" (:558) is therefore read as a
 *    closed choice — which query, which mark, which level — with the formatter rendering every number:
 *    an Interpretation, not a Deviation, recorded as s-ask I-395 once the owner ruled it (Q4).
 * 4. No recording is needed here. The journey lane hands every process the fixture root
 *    (tests/e2e/support/journey-env.ts:40-48), and a request with no recorded answer refuses
 *    FIXTURE_MISSING (src/core/model/fixture.ts:23,37), never a network call. This leg therefore asks
 *    only questions the product's grammar reads with no model call (s-ask §6), so no recording gates
 *    it and no fixture is tied to a register M3 keeps moving; the Jev-routed paraphrase is J-043's,
 *    recorded in session through scripts/model-corpus.ts (ASK-2).
 *
 * THE LAW THAT FORCES IT. C-13 (cubit.bible.xml:800). L-AI-01 (:263): one path, replayed from
 * fixtures inside verify, a missing fixture is FIXTURE_MISSING. L-AI-03 (:265): the model may "answer
 * questions with citations" and never writes a register row, a rate, a signature or an act. R-AI-003
 * (:558): every number in an answer is a query result rendered by the formatter.
 *
 * HONEST SIZE. L, in three slices after the Decision: the grammar, the query registry, the ASK_* codes
 * and the ai procedure through authorize() (ASK-1a); the screen, its seven states and J-043 (ASK-1b);
 * the sheet-text questions and this walk (ASK-3).
 *
 * The increment that lands these doors deletes this fixme and its line in
 * tests/journeys/fixme-roster.test.ts and writes the walk here; it never deletes the file (AM-09 §3,
 * AM-17).
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M4's question of the drawings (AM-09 §3, AM-17), owed", () => {
  test.fixme("MISSING DOOR: J-000 m4-ask-the-drawings: S-Ask is decided (docs/design/s-ask.md, C-13) and not built — the ai router holds no procedure, no grammar reads a question and no query over the register answers one", () => {
    // AM-09 §3, AM-17: the walk lands with its doors; until then the leg is declared, collected and impossible to forget.
  });
});
