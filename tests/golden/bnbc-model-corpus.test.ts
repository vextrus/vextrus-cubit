// @vitest-environment node
/**
 * The recorded corpus answers every question the product composes over the committed F-RCC6-BNBC
 * drawing (L-AI-01, Q-08; wave 3a-R0, R0-REC, I-610).
 *
 * R0 regenerated the BNBC set (Rev C), and a regenerated drawing moves request hashes: a schedule row
 * whose cells moved, a note clause S-01 now writes, a state rewritten for the raised EGL — each is a
 * new request, and a replay that meets one the corpus never recorded refuses FIXTURE_MISSING. This
 * suite replays the corpus recorders themselves (`scripts/model-corpus/*`, the one home of "which
 * subjects are asked") over the committed DXF, with no network and no key, and requires that every
 * request they compose is filed in `fixtures/model` and rostered under its own question:
 *
 *  - schedule-cell: every contested row of every schedule the drawing carries;
 *  - note-clause: every clause the grammar reads nothing in on the two general-notes sheets the
 *    corpus records (S-01, S-02 — the sheets the product reads general notes off today);
 *  - view-caption: every caption the partition asks about;
 *  - boq-line-description: every committed hand-written state;
 *  - sheet-revision-recency: the 27 recency requests, EQUAL to the roster's — R0 must not move them.
 *
 * It lives in the golden lane because it judges the fixture evidence (the regenerated corpus and the
 * recordings over it) and ingests the drawing through the shipped cad CLI three times, which the
 * unit lane's ceiling cannot carry. Outline corroboration is recorded over F-RCC6 (`rcc6.dxf`), not
 * BNBC, and was never recorded over BNBC before R0 either; it is not claimed here.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MODEL_QUESTIONS, requestHash, type ModelQuestion } from "../../src/core/model";
import type { Asked, RecorderContext } from "../../scripts/model-corpus/recorder";
import { CORPUS_RECORDERS } from "../../scripts/model-corpus/registry";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const CORPUS_ROOT = join(REPO_ROOT, "fixtures", "model");
const BNBC_DXF = join(REPO_ROOT, "fixtures", "rcc6-bnbc", "rcc6-bnbc.dxf");

/** The general-notes sheets the note-clause corpus is recorded over. */
const NOTE_SHEETS = "S-01 GENERAL NOTES (1 OF 2),S-02 GENERAL NOTES (2 OF 2) & LAP-DEVELOPMENT TABLE";

/** How many sheet-revision-recency requests the corpus answers, and R0 must leave unmoved. */
const RECENCY_REQUESTS = 27;

type RosterLine = { requestHash: string; question: string; subject: string };

function roster(): RosterLine[] {
  return (JSON.parse(readFileSync(join(CORPUS_ROOT, "corpus.json"), "utf8")) as { fixtures: RosterLine[] }).fixtures;
}

async function subjects(question: ModelQuestion, options: Readonly<Record<string, string>>): Promise<Asked[]> {
  const ctx: RecorderContext = {
    option: (name) => options[name],
    fail: (message) => {
      throw new Error(`${question}: ${message}`);
    },
    say: () => undefined,
    corpusRoot: CORPUS_ROOT,
  };
  return CORPUS_RECORDERS[question](ctx);
}

/** Every subject whose request has no filed fixture or no roster line under its question, named. */
function unanswered(question: ModelQuestion, asked: readonly Asked[]): string[] {
  const rostered = new Set(roster().filter((line) => line.question === question).map((line) => line.requestHash));
  return asked
    .map((one) => ({ hash: requestHash(one.request), subject: one.subject }))
    .filter(({ hash }) => !existsSync(join(CORPUS_ROOT, `${hash}.json`)) || !rostered.has(hash))
    .map(({ hash, subject }) => `${hash}  ${subject}`);
}

const asked = new Map<ModelQuestion, Asked[]>();

beforeAll(async () => {
  const onDrawing = { "--drawing": BNBC_DXF, "--limit": "100000" };
  asked.set(MODEL_QUESTIONS.scheduleCell, await subjects(MODEL_QUESTIONS.scheduleCell, onDrawing));
  asked.set(MODEL_QUESTIONS.noteClause, await subjects(MODEL_QUESTIONS.noteClause, { ...onDrawing, "--layouts": NOTE_SHEETS }));
  asked.set(MODEL_QUESTIONS.viewCaption, await subjects(MODEL_QUESTIONS.viewCaption, onDrawing));
  asked.set(MODEL_QUESTIONS.boqLineDescription, await subjects(MODEL_QUESTIONS.boqLineDescription, { "--limit": "100000" }));
  asked.set(MODEL_QUESTIONS.sheetRevisionRecency, await subjects(MODEL_QUESTIONS.sheetRevisionRecency, { "--limit": "100000" }));
}, 180_000);

describe("the model corpus over the regenerated F-RCC6-BNBC (R0-REC)", () => {
  const drawn: readonly [ModelQuestion, number][] = [
    [MODEL_QUESTIONS.scheduleCell, 134],
    [MODEL_QUESTIONS.noteClause, 42],
    [MODEL_QUESTIONS.viewCaption, 10],
  ];
  for (const [question, count] of drawn) {
    it(`${question}: the drawing's ${count} subjects are each filed and rostered — no replay of them is FIXTURE_MISSING`, () => {
      const held = asked.get(question) ?? [];
      expect(held.length, `the recorder finds the ${question} subjects Rev C draws; a drawing that asked nothing proves nothing`).toBe(count);
      expect(unanswered(question, held), `a ${question} request the committed corpus does not answer refuses FIXTURE_MISSING in replay`).toEqual([]);
    });
  }

  it("boq-line-description: every committed state is filed and rostered", () => {
    const held = asked.get(MODEL_QUESTIONS.boqLineDescription) ?? [];
    expect(held.length, "the four hand-written states (two excavation arms, two brickwork thicknesses)").toBe(4);
    expect(unanswered(MODEL_QUESTIONS.boqLineDescription, held)).toEqual([]);
  });

  it(`sheet-revision-recency: the ${RECENCY_REQUESTS} request hashes equal the roster's, exactly — R0 moved none`, () => {
    const held = [...new Set((asked.get(MODEL_QUESTIONS.sheetRevisionRecency) ?? []).map((one) => requestHash(one.request)))].sort();
    const rostered = roster()
      .filter((line) => line.question === MODEL_QUESTIONS.sheetRevisionRecency)
      .map((line) => line.requestHash)
      .sort();
    expect(held.length).toBe(RECENCY_REQUESTS);
    expect(held, "the recency recorder composes the same requests the corpus answers").toEqual(rostered);
    expect(unanswered(MODEL_QUESTIONS.sheetRevisionRecency, asked.get(MODEL_QUESTIONS.sheetRevisionRecency) ?? [])).toEqual([]);
  });
});
