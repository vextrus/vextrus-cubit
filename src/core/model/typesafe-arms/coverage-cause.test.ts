// @vitest-environment node
/**
 * The coverage-cause arm, at the wire (R-TO-052, L-AI-01, L-AI-02, AM-11).
 *
 * What is judged here is what this arm POSTS and how it READS what Jev chose: the key set it is
 * recognised by, the closed candidate set the criteria are built over, the whole meaning carried in
 * the instructions themselves, and the two things it refuses to do — supply a cause Jev did not
 * choose, and put a question over a cell no channel sighted. What that reading then becomes — a
 * Proposal or a refusal — is the caller's, judged by tests/takeoff/coverage/cause-proposal.test.ts.
 *
 * No network and no key: the arm is exercised directly, exactly as `arms-bodies.test.ts` exercises
 * the two arms whose corpus was already recorded.
 */
import { describe, expect, test } from "vitest";
import { SCOPE_DECLARATION_CAUSES } from "../../errors/residue";
import { canonicalJson } from "../canonical";
import { MODEL_QUESTIONS } from "../questions";
import { structuredTaskOf } from "../typesafe";
import type { ModelRequest } from "../types";
import { NOTHING_TO_DECLARE, coverageCauseArm, type CauseTask } from "./coverage-cause";

/**
 * One unmeasured cell of the BNBC campaign, spelled here rather than composed: the builder is
 * `@/modules/takeoff/coverage`'s, which core may not import (ARCH-01) — the same reason
 * `arms-bodies.test.ts` pins the sheet's user message instead of composing it. That the module still
 * composes exactly this key set is tied down beside the builder, in
 * tests/takeoff/coverage/cause-proposal.test.ts.
 */
const STATE = {
  cell: { kind: "rcc.concrete", class: "column", level: "2F", ordinal: 2 },
  key: "DXF_HANDLE:10A2",
  sightings: [{ channel: "PARTITION", layout: "S-10 COLUMN LAYOUT PLAN" }],
  observations: [{ rail: "column/rcc.concrete", reason: "Nobody has read a plan for this member, so there is no outline, thickness or run to measure it by." }],
} as const;

/** The canonical content that state is asked as — the content the request hash is taken over. */
function content(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...(JSON.parse(canonicalJson(STATE as never)) as Record<string, unknown>), ...over };
}

/** A request carrying that content, as the wire sees one: the other fields are the module's, unread. */
function causeRequest(over: Record<string, unknown> = {}): ModelRequest {
  return { modelId: "claude-sonnet-5", system: "(the module's own system prompt — not read by any arm)", messages: [{ role: "user", content: canonicalJson(content(over) as never) }] };
}

/** The task this arm recognises the corpus state as. */
function task(): CauseTask {
  const read = coverageCauseArm.recognise(content());
  expect(read, "the arm recognises the content its own builder composes").not.toBeNull();
  return read as CauseTask;
}

/** The composed body, typed as far as this file reads it. */
type Body = { model: string; state: Record<string, unknown>; questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }> };

function body(): Body {
  return coverageCauseArm.compose(task()).body as unknown as Body;
}

describe("the coverage cause, as Jev is asked it", () => {
  test("the arm is filed under the question the ledger and the corpus roster name it by", () => {
    expect(coverageCauseArm.question).toBe(MODEL_QUESTIONS.coverageCause);
    expect(coverageCauseArm.question).toBe("coverage-cause");
  });

  test("the key set is the one the builder spells, sorted, and the registry routes a whole request to this arm", () => {
    expect([...coverageCauseArm.keys], "the arm is recognised by the exact sorted key set of the canonical content").toEqual(["cell", "key", "observations", "sightings"]);
    expect(Object.keys(content()).sort()).toEqual([...coverageCauseArm.keys]);
    const routed = structuredTaskOf(causeRequest());
    expect(routed?.kind, "a coverage-cause request reaches this arm and no other").toBe("cause");
  });

  test("the state posted is the evidence and nothing else — the citable key is what an answer RESTS on, never state", () => {
    const posted = body();
    expect(posted.model).toBe("jev-latest");
    expect(Object.keys(posted.state).sort()).toEqual(["cell", "observations", "sightings"]);
    expect(posted.state["cell"]).toEqual({ kind: "rcc.concrete", class: "column", level: "2F", ordinal: 2 });
    expect(posted.state["sightings"]).toEqual([{ channel: "PARTITION", layout: "S-10 COLUMN LAYOUT PLAN" }]);
    expect(JSON.stringify(posted.state), "no uuid and no source key reach the state Jev reads").not.toContain("DXF_HANDLE");
  });

  test("one choice, over the causes a PERSON may declare plus the no-match outcome, and no other candidate", () => {
    const question = body().questions["cause"];
    expect(Object.keys(body().questions), "the arm asks exactly one question").toEqual(["cause"]);
    expect(question?.type).toBe("choice");
    expect(Object.keys(question?.criteria ?? {}), "the candidate set is the closed roster plus the no-match outcome").toEqual([
      ...SCOPE_DECLARATION_CAUSES,
      NOTHING_TO_DECLARE,
    ]);
    // The machine's own causes are read off the campaign by arm order and win before a cell ever
    // reads NOT_ESTABLISHED, so Jev is never offered one and cannot answer one (L-QTY-05).
    for (const machine of ["INGESTION_TRUNCATED", "NO_BEARER_SIGHTED", "KIND_NOT_YET_SEEDED", "NOT_ESTABLISHED"]) {
      expect(Object.keys(question?.criteria ?? {}), `${machine} is the campaign's reading, never a cause to propose`).not.toContain(machine);
    }
    for (const criterion of Object.values(question?.criteria ?? {})) expect(criterion.length, "every candidate carries a criterion in words").toBeGreaterThan(20);
  });

  test("the instructions carry the whole meaning, naming the state by its backticked field paths and never the question's id", () => {
    const instructions = body().questions["cause"]?.instructions ?? "";
    for (const path of ["`cell`", "`cell.kind`", "`cell.class`", "`cell.level`", "`cell.ordinal`", "`sightings`", "`sightings[].channel`", "`sightings[].layout`", "`observations`", "`observations[].rail`", "`observations[].reason`"]) {
      expect(instructions, `the instructions reference the state by ${path}`).toContain(path);
    }
    expect(instructions, "the no-match outcome is spelled where a reader of the question meets it").toContain(NOTHING_TO_DECLARE);
    expect(instructions, "a question's id is never sent — the instructions stand on their own").not.toContain("`cause`");
  });

  test("a chosen cause reads to the wire the seam resolves, citing the cell's OWN key and nothing else", () => {
    const read = coverageCauseArm.compose(task()).read({ cause: { choice: "NOT_IN_THIS_BILL", confidence: 0.91 } });
    expect(read).toEqual({ payload: { cause: "NOT_IN_THIS_BILL" }, sources: ["DXF_HANDLE:10A2"] });
  });

  test("nothing is supplied where Jev supplied nothing: an answer with no choice reads null, for the caller to refuse", () => {
    const composed = coverageCauseArm.compose(task());
    expect(composed.read({ cause: { confidence: 0.4 } })).toEqual({ payload: { cause: null }, sources: ["DXF_HANDLE:10A2"] });
    expect(composed.read({}), "an answer for another question's id is no choice of this one").toEqual({ payload: { cause: null }, sources: ["DXF_HANDLE:10A2"] });
  });

  test("a near-miss content is recognised as nothing, rather than guessed at", () => {
    expect(coverageCauseArm.recognise(content({ cell: "column on 2F" })), "a cell that is not a cell is not this task").toBeNull();
    expect(coverageCauseArm.recognise(content({ sightings: [{ channel: "PARTITION" }] })), "a sighting missing its layout is not this task").toBeNull();
    expect(coverageCauseArm.recognise(content({ observations: [{ rail: "column/rcc.concrete", code: "PLAN_READING_ABSENT" }] })), "an observation missing its reason is not this task").toBeNull();
    expect(coverageCauseArm.recognise(content({ key: 12 })), "a key that is not text is not this task").toBeNull();
  });

  test("a cell no channel sighted is not put to Jev at all — the guard throws and no question is posted (B-14)", () => {
    const bare = coverageCauseArm.recognise(content({ sightings: [] })) as CauseTask;
    expect(bare, "an empty sighting list is still a well-formed task — it is the guard that refuses it").not.toBeNull();
    expect(() => coverageCauseArm.guard?.(bare)).toThrow(/carries no sighting/u);
    expect(() => coverageCauseArm.guard?.(task()), "a sighted cell is posted").not.toThrow();
  });
});
