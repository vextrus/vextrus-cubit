// @vitest-environment node
/**
 * The corroboration question, as the product composes it and reads it back (L-QTY-04, L-AI-01,
 * L-AI-02).
 *
 * Three things are judged here. That the request is a pure, total function of the evidence — the
 * same outline makes the same request, and so the same hash, forever, which is what lets a recorded
 * answer be replayed in every lane. That the decoder takes a probability and NOTHING else, so a
 * payload that is not one is a reading no caller may take. And that a refusal reaches the caller
 * intact: abstention is the caller's decision, never the model's.
 */
import { describe, expect, test } from "vitest";
import { MODEL_QUESTIONS, requestHash, sourceKeyResolver } from "../model";
import type { ModelCallContext, Proposal } from "../model";
import { OUTLINE_CORROBORATION_MODEL, outlineCorroborationRequest, proposeOutlineCorroboration, readCorroborationProposal, type OutlineEvidence } from "./index";

const CTX: ModelCallContext = {
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  projectId: "d3e00000-0000-4000-8000-000000000002",
  actor: "user:test",
  requestId: "req-test-corroboration-1",
};

/** One placed outline, as `outlineEvidenceOf` finds one. */
const EVIDENCE: OutlineEvidence = {
  mark: "C4",
  class: "column",
  outlineKey: "DXF_HANDLE:4A1",
  markKey: "DXF_HANDLE:4A2",
  outlineLongest: 1.5,
  outlineShorter: 1.25,
  outlineArea: 1.875,
  planMedianLongest: 1.5,
  statedLongest: 1.5,
  statedShorter: 1.25,
  nearAnchorDistance: 0.4,
  nearAnchorReach: 9,
  gridSpacing: 10,
  footprintMin: 0.6,
  footprintMax: 2.5,
};

/** The state one request carries, read back off the request itself. */
function stateOf(evidence: OutlineEvidence): Record<string, unknown> {
  return JSON.parse(outlineCorroborationRequest(evidence).messages[0]?.content ?? "{}") as Record<string, unknown>;
}

describe("the question one deferred outline is asked", () => {
  test("names the closed question, and is pinned to the model AS-05 charges it under", () => {
    const request = outlineCorroborationRequest(EVIDENCE);
    expect(request.question).toBe(MODEL_QUESTIONS.outlineCorroboration);
    expect(request.modelId).toBe(OUTLINE_CORROBORATION_MODEL);
    expect(request.system, "the answer's exact shape is stated, because L-AI-02 refuses one that is not it").toContain("sources");
  });

  test("is the same request for the same outline — the hash is a fact about the drawing, not about the run", () => {
    expect(requestHash(outlineCorroborationRequest(EVIDENCE))).toBe(requestHash(outlineCorroborationRequest({ ...EVIDENCE })));
  });

  test("rounds every figure in the builder, so a float's last bit cannot re-key a recorded answer", () => {
    const state = stateOf({ ...EVIDENCE, outlineLongest: 1.4999999999999998, nearAnchorDistance: 0.1 + 0.2 });
    expect(state["outlineLongest"]).toBe(1.5);
    expect(state["nearAnchorDistance"]).toBe(0.3);
  });

  test("carries a silent schedule as silence, never as a number nobody read", () => {
    const state = stateOf({ ...EVIDENCE, statedLongest: null, statedShorter: null });
    expect(state["statedLongest"]).toBeNull();
    expect(state["statedShorter"]).toBeNull();
    expect(Object.keys(state), "the key set stands whichever way the schedule read").toEqual(Object.keys(stateOf(EVIDENCE)));
  });

  test("refuses to state a figure that is no figure at all", () => {
    expect(() => outlineCorroborationRequest({ ...EVIDENCE, planMedianLongest: Number.NaN })).toThrow(/no figure a question can be asked over/);
  });
});

describe("what a caller may take from an answer", () => {
  test("a probability, and nothing else", () => {
    expect(readCorroborationProposal({ corroborates: 0.93 })).toEqual({ ok: true, value: { corroborates: 0.93 } });
    expect(readCorroborationProposal({ corroborates: 0 })).toEqual({ ok: true, value: { corroborates: 0 } });
  });

  test("a payload that is not a probability is no reading", () => {
    for (const payload of [null, 0.9, [0.9], { corroborates: "0.93" }, { corroborates: 1.4 }, { corroborates: -0.1 }, { corroborates: 0.9, mark: "C4" }, {}]) {
      expect(readCorroborationProposal(payload as never).ok, `${JSON.stringify(payload)} is refused`).toBe(false);
    }
  });
});

describe("the seam is the one path, and a refusal is the caller's to answer", () => {
  test("the proposal is asked through `propose`, over the request the builder composed", async () => {
    let asked: { hash: string; question: string | undefined } | null = null;
    const proposal = await proposeOutlineCorroboration(
      CTX,
      { evidence: EVIDENCE, artifact: sourceKeyResolver("sha256:test-artifact", [EVIDENCE.outlineKey, EVIDENCE.markKey]) },
      {
        propose: async (_ctx, request, contract) => {
          asked = { hash: requestHash(request), question: request.question };
          const read = contract.decode({ corroborates: 0.93 });
          if (!read.ok) throw new Error(read.detail);
          return {
            payload: read.value,
            sources: [EVIDENCE.outlineKey, EVIDENCE.markKey],
            model: OUTLINE_CORROBORATION_MODEL,
            callId: "00000000-0000-4000-8000-00000000000c",
          } as unknown as Proposal<never>;
        },
      },
    );
    expect(proposal.payload.corroborates).toBe(0.93);
    expect(proposal.sources).toEqual([EVIDENCE.outlineKey, EVIDENCE.markKey]);
    expect(asked).toEqual({ hash: requestHash(outlineCorroborationRequest(EVIDENCE)), question: MODEL_QUESTIONS.outlineCorroboration });
  });

  test("a refused call reaches the caller intact — nothing here decides that the outline abstains", async () => {
    const refused = new Error("FIXTURE_MISSING");
    await expect(
      proposeOutlineCorroboration(
        CTX,
        { evidence: EVIDENCE, artifact: sourceKeyResolver("sha256:test-artifact", [EVIDENCE.outlineKey]) },
        {
          propose: async () => {
            throw refused;
          },
        },
      ),
    ).rejects.toBe(refused);
  });
});
