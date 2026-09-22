/**
 * The cause of one unmeasured cell, put to TypeSafe Jev System One end to end through the seam's one
 * public path (R-TO-052, L-AI-01, L-AI-02, L-AI-03, s-coverage I-297).
 *
 * This is the tie neither half can make alone: `coverageCauseRequest` is the takeoff module's, and
 * core may not import it (ARCH-01); the arm that recognises it is the seam's interior, and nothing
 * outside `src/core/model/` may reach in (`cubit/no-model-outside-seam`). So the two meet where the
 * product makes them meet — over `createModelSeam` with a fetch the test hands in — and what is
 * graded is what Jev is POSTED for a state this module composes, and what its choice becomes.
 *
 * No network and no key: the fetch is the test's own and the "key" is a literal nobody can spend.
 */
import { describe, expect, test, vi } from "vitest";
import { refusalCodeOf } from "@/core/faults/refusal-marker";
import { SCOPE_DECLARATION_CAUSES } from "@/core/errors";
import { createModelSeam, sourceKeyResolver } from "@/core/model";
import { coverageCauseRequest, readCoverageCauseProposal, type CoverageCauseState } from "@/modules/takeoff/coverage/cause-proposal";

const TENANT = "d3e00000-0000-4000-8000-000000000001";
const PROJECT = "d3e00000-0000-4000-8000-000000000002";

/** The answer this question's arm reads: one choice, filed under the question's own id. */
const NOTHING_TO_DECLARE = "NOTHING_TO_DECLARE";

const STATE: CoverageCauseState = {
  cell: { kind: "rcc.concrete", class: "column", level: "2F", ordinal: 2 },
  key: "DXF_HANDLE:10A2",
  sightings: [{ channel: "PARTITION", layout: "S-10 COLUMN LAYOUT PLAN" }],
  observations: [{ rail: "column/rcc.concrete", reason: "Nobody has read a plan for this member, so there is no outline, thickness or run to measure it by." }],
};

type Posted = { model: string; state: Record<string, unknown>; questions: Record<string, { type: string; instructions: string; criteria: Record<string, string> }> };

/** Jev, as a fetch: records what it was posted and answers the choice the case names. */
function jevAnswering(choice: string | null, confidence = 0.93) {
  const posted: Posted[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
    posted.push(JSON.parse(String(init?.body)) as Posted);
    const answer = choice === null ? {} : { cause: { type: "choice", choice, confidence, probabilities: { [choice]: confidence } } };
    return new Response(JSON.stringify({ model: "jev-2026-09-01", answers: answer, usage: { input_tokens: 220, output_tokens: 0 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch, posted };
}

function seamOver(fetch: typeof globalThis.fetch) {
  const rows: Record<string, unknown>[] = [];
  const ledger = {
    record: async (row: Record<string, unknown>) => {
      rows.push(row);
      return { callId: `call-${rows.length}` };
    },
  };
  return { seam: createModelSeam({ env: { TYPESAFE_API_KEY: "test-key", NODE_ENV: "production" }, fetch, ledger: ledger as never }), rows };
}

const CTX = { tenantId: TENANT, projectId: PROJECT, actor: "user:test", requestId: "req-coverage-cause-1" };
const CONTRACT = { artifact: sourceKeyResolver("rev-1", [STATE.key]), decode: readCoverageCauseProposal(SCOPE_DECLARATION_CAUSES) };

describe("one unmeasured cell, asked and answered", () => {
  test("the state this module composes reaches the coverage-cause arm, and Jev is posted the closed choice", async () => {
    const jev = jevAnswering("NOT_IN_THIS_BILL");
    const { seam, rows } = seamOver(jev.fetch);
    const proposal = await seam.propose(CTX, coverageCauseRequest(STATE), CONTRACT);

    expect(jev.posted.length, "one cell, one question, one call").toBe(1);
    const body = jev.posted[0] as Posted;
    expect(Object.keys(body.state).sort(), "the evidence is posted as state — the citable key is not state").toEqual(["cell", "observations", "sightings"]);
    expect(Object.keys(body.questions)).toEqual(["cause"]);
    expect(Object.keys(body.questions["cause"]?.criteria ?? {}), "the candidates are the declarable roster plus the no-match outcome").toEqual([
      ...SCOPE_DECLARATION_CAUSES,
      NOTHING_TO_DECLARE,
    ]);

    expect(proposal.payload, "what comes back is a cause of the caller's own declarable set").toEqual({ cause: "NOT_IN_THIS_BILL" });
    expect(proposal.sources, "citing the one key code found for this cell, and nothing else (L-AI-02)").toEqual([STATE.key]);
    expect(rows.length, "every call is a ledger row (L-AI-01)").toBe(1);
    expect(rows[0]?.["question"], "filed under the question's own name, which is the whole registration").toBe("coverage-cause");
    expect(rows[0]?.["outcome"]).toBe("proposed");
    expect((rows[0]?.["judgment"] as { confidence?: number } | null)?.confidence, "the confidence the caller's floor is read against is a ledger fact").toBe(0.93);
  });

  test("the honest abstention is a refusal by name, and the tokens it spent stay attributed", async () => {
    const jev = jevAnswering(NOTHING_TO_DECLARE, 0.41);
    const { seam, rows } = seamOver(jev.fetch);
    const refused = await seam.propose(CTX, coverageCauseRequest(STATE), CONTRACT).catch((thrown: unknown) => thrown);
    expect(refusalCodeOf(refused), "no boundary at all is no boundary to propose — MALFORMED, the honest answer it is").toBe("MALFORMED");
    expect(rows.length).toBe(1);
    expect(rows[0]?.["outcome"], "the model answered, so the call is recorded as refused with its spend").toBe("refused");
    expect(rows[0]?.["inputTokens"]).toBe(220);
  });

  test("an answer Jev gave no choice for is refused too — nothing is supplied where nothing was said", async () => {
    const jev = jevAnswering(null);
    const { seam } = seamOver(jev.fetch);
    const refused = await seam.propose(CTX, coverageCauseRequest(STATE), CONTRACT).catch((thrown: unknown) => thrown);
    expect(refusalCodeOf(refused)).toBe("MALFORMED");
  });

  test("an answer resting on a key this cell was never sighted at is refused against the artifact", async () => {
    const jev = jevAnswering("NOT_IN_PROJECT_SCOPE");
    const { seam } = seamOver(jev.fetch);
    const refused = await seam
      .propose(CTX, coverageCauseRequest(STATE), { artifact: sourceKeyResolver("rev-1", ["DXF_HANDLE:FFFF"]), decode: readCoverageCauseProposal(SCOPE_DECLARATION_CAUSES) })
      .catch((thrown: unknown) => thrown);
    expect(refusalCodeOf(refused), "a citation the artifact does not hold resolves to nothing").toBe("SOURCE_UNRESOLVED");
  });

  test("no recording and no key means FIXTURE_MISSING, never a network call (L-AI-01)", async () => {
    const unreachable = vi.fn<typeof globalThis.fetch>(async () => new Response("unreachable", { status: 599 }));
    const rows: Record<string, unknown>[] = [];
    const seam = createModelSeam({
      env: { NODE_ENV: "test" },
      fetch: unreachable,
      ledger: {
        record: async (row: Record<string, unknown>) => {
          rows.push(row);
          return { callId: `call-${rows.length}` };
        },
      } as never,
    });
    // STATE itself is the corpus's first committed state and has been recorded since the corpus
    // was filed (2026-09-22), so a request over it REPLAYS; the cell outside the corpus is a storey
    // the nine states never name.
    const unrecorded: CoverageCauseState = { ...STATE, cell: { ...STATE.cell, level: "9F", ordinal: 9 } };
    const refused = await seam.propose(CTX, coverageCauseRequest(unrecorded), CONTRACT).catch((thrown: unknown) => thrown);
    expect(refusalCodeOf(refused), "a cell outside the corpus is a refusal a caller handles, never a crash").toBe("FIXTURE_MISSING");
    expect(unreachable, "and never a call to a provider").not.toHaveBeenCalled();
    expect(rows[0]?.["question"], "the refused call is still this question's ledger row").toBe("coverage-cause");
  });
});
