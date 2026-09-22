/**
 * AC — the draft's item-description question, its decoder and the caller's own policy (L-BD-01,
 * L-AI-02, L-AI-03, I-298).
 *
 * Three things are graded:
 *   1. THE REQUEST IS PURE OVER THE STATE. The same group of the same pinned revision composes the
 *      same request forever, so a recorded answer is filed under a fact about the register rather
 *      than about the run (L-AI-01) — and the question's NAME is not hashed into it, so renaming a
 *      question does not orphan a corpus. The adapter recognises what the builder composes.
 *   2. THE ANSWER IS READ BACK OUT OF THE CALLER'S OWN CANDIDATE SET. An id outside it is refused
 *      as MALFORMED rather than stored; the no-match outcome is a first-class reading.
 *   3. ABSTENTION IS THE CALLER'S. A refusal leaves the plain description standing and the draft
 *      reads on; a group the catalogue holds one description for is never asked at all.
 *
 * Nothing here opens a database and nothing reaches a provider: the port is handed in (B-23).
 */
import { describe, expect, test } from "vitest";
import { candidateItemsFor } from "@/core/catalogue/item-descriptions";
import { REFUSALS } from "@/core/errors";
import { refusal } from "@/core/faults/refusal-marker";
import { PROPOSAL_KIND, requestHash, type ModelCallContext, type ModelRequest, type Proposal, type ProposalContract, type SourceKey } from "@/core/model";
import { boqDraftPayloadOf } from "@/modules/takeoff/boq/emission";
import { boqDescriptionRequest, readItemDescriptionProposal, type BoqDescriptionPort, type BoqDescriptionState } from "@/modules/takeoff/boq/description-question";
import { DEFAULTED, INTERPRETED, describeGroups, groupAsksOf, groupKeyOf, type DescribableLine } from "@/modules/takeoff/boq/descriptions";

const CTX: ModelCallContext = { tenantId: "t", projectId: "p", actor: "u", requestId: "r" };
const DIGEST = "artifact-digest";
const HANDLE = "DXF_HANDLE:1D4C";

/** The storeys the lines below stand on, as the residue stacks them. */
const LEVELS = [
  { levelId: "l-gf", ordinal: 0, label: "GF" },
  { levelId: "l-1f", ordinal: 1, label: "1F" },
];

/** One published line, as the register hands one over — a brick wall with its thickness stated. */
function wallLine(overrides: Partial<DescribableLine> = {}): DescribableLine {
  return {
    class: "brick_wall",
    kind: "masonry.brickwork",
    unit: "m3",
    levelId: "l-1f",
    quantityBasis: "TRANSCRIBED",
    selectionBasis: "TRANSCRIBED",
    drawingId: "d-1",
    selectors: { thickness: { value: "250", unit: "mm", basis: "TRANSCRIBED", source: HANDLE } },
    ...overrides,
  };
}

/** The state the wall's question is asked over, as `groupAsksOf` composes it. */
function wallState(): BoqDescriptionState {
  const [ask] = groupAsksOf([wallLine()], LEVELS, new Map([["d-1", DIGEST]]));
  expect(ask, "the brick wall is a group with a description to choose").toBeDefined();
  return (ask as { state: BoqDescriptionState }).state;
}

/** A port that answers one wire payload, or throws the refusal the seam would throw (L-AI-02). */
function portAnswering(payload: unknown, callId = "call-1"): BoqDescriptionPort {
  return {
    propose: async <T,>(_ctx: ModelCallContext, _request: ModelRequest, contract: ProposalContract<T>): Promise<Proposal<T>> => {
      const decoded = contract.decode(payload as never);
      if (!decoded.ok) throw refusal(REFUSALS.MALFORMED.code, decoded.detail, {});
      return { kind: PROPOSAL_KIND, payload: decoded.value, sources: [HANDLE as SourceKey], model: "claude-sonnet-5", callId };
    },
  };
}

/** A port that refuses every call, the way the fixture transport refuses a state nobody recorded. */
const REFUSING: BoqDescriptionPort = {
  propose: async () => {
    throw refusal(REFUSALS.FIXTURE_MISSING.code, "no recorded answer stands for this request", {});
  },
};

describe("the item-description request", () => {
  test("is pure over the state, and the question's name is not hashed into it", () => {
    const state = wallState();
    expect(requestHash(boqDescriptionRequest(state)), "the same state composes the same request forever").toBe(requestHash(boqDescriptionRequest(state)));
    const renamed = { ...boqDescriptionRequest(state), question: "another-name" };
    expect(requestHash(renamed), "the same evidence asked under a renamed question is the same request (L-AI-01)").toBe(requestHash(boqDescriptionRequest(state)));
  });

  test("spells the key set the adapter recognises this question by, and names the question and the pinned id", () => {
    const request = boqDescriptionRequest(wallState());
    const content = JSON.parse(request.messages[0]?.content ?? "{}") as Record<string, unknown>;
    // The adapter recognises a request by the sorted key set of its canonical content and by nothing
    // else. `src/core/model` is the one lawful import of the seam (`cubit/no-model-outside-seam`),
    // so the tie is made from both sides: the arm pins this key set in its own suite beside it
    // (src/core/model/typesafe-arms/boq-line-description.test.ts), and what the draft composes is
    // pinned here.
    expect(Object.keys(content).sort(), "the four keys the boq-line-description arm is recognised by").toEqual(["attributes", "candidates", "keys", "line"]);
    expect(request.question, "the ledger records which closed question this call was").toBe("boq-line-description");
    expect(request.modelId, "AS-05's cheap-classification id carries the call until an amendment moves it").toBe("claude-sonnet-5");
  });

  test("names the pinned model and the closed answer shape in its own system prompt", () => {
    const request = boqDescriptionRequest(wallState());
    expect(request.system, "the answer's exact wire shape is stated, because L-AI-02 refuses anything else").toContain('{"payload": {"item": "<id>"}, "sources": ["<key>"]}');
    expect(request.system, "the model is told the description is chosen and never written (L-AI-03)").toContain("never written");
  });
});

describe("the decoder", () => {
  const candidates = candidateItemsFor("brick_wall", "masonry.brickwork");
  const read = readItemDescriptionProposal(candidates);

  test("reads a chosen id back out of the caller's own candidate set", () => {
    const chosen = candidates[0];
    expect(read({ item: chosen?.id ?? "" }), "what comes back is a row of the set the question offered").toEqual({ ok: true, value: { item: chosen } });
  });

  test("takes the no-match outcome as a reading, not a failure", () => {
    expect(read({ item: "NONE_OF_THESE" }), "an abstention answers nothing chosen, and the caller decides").toEqual({ ok: true, value: { item: null } });
  });

  test("refuses an id outside the set, a payload of another shape, and a payload naming more", () => {
    expect(read({ item: "masonry.brickwork/brick_wall/nominal-999" }).ok, "an id this line may not be billed under is no reading").toBe(false);
    expect(read({ item: candidates[0]?.id ?? "", extra: 1 }).ok, "a payload naming more than the one field is no reading").toBe(false);
    expect(read("nominal-250").ok, "a payload that is not an object is no reading").toBe(false);
  });
});

describe("the caller's own policy", () => {
  test("asks one question per group that has a description to choose, and none where the catalogue holds one", () => {
    const asks = groupAsksOf(
      [
        wallLine(),
        wallLine({ levelId: "l-gf" }),
        // A column's concrete: the catalogue holds one description for it, so there is nothing to
        // select and no call is made (I-298).
        { ...wallLine(), class: "column", kind: "rcc.concrete", unit: "m3" },
      ],
      LEVELS,
      new Map([["d-1", DIGEST]]),
    );
    expect(asks.map((ask) => ask.key), "only the divided pair is asked about").toEqual([groupKeyOf("brick_wall", "masonry.brickwork")]);
    expect(asks[0]?.state.line.levels, "the group's storeys travel by label, in ordinal order").toEqual(["GF", "1F"]);
    expect(asks[0]?.state.keys, "the citations are the attributes' own source keys, said once each").toEqual([HANDLE]);
    expect(asks[0]?.state.attributes, "what the drawings state travels as written (L-MEA-06)").toEqual([{ name: "thickness", valueAsWritten: "250", unitAsWritten: "mm" }]);
  });

  test("asks nothing about a group that states nothing, or whose drawing this product never ingested", () => {
    const stateless = groupAsksOf([wallLine({ selectors: {} })], LEVELS, new Map([["d-1", DIGEST]]));
    expect(stateless, "a group with no stated attribute is not asked — an answer could cite nothing (L-AI-02)").toEqual([]);
    const undigested = groupAsksOf([wallLine()], LEVELS, new Map());
    expect(undigested, "a drawing with no ingest record has no artifact a citation could resolve against").toEqual([]);
  });

  test("carries a chosen description as INTERPRETED, with the call it came from", async () => {
    const asks = groupAsksOf([wallLine()], LEVELS, new Map([["d-1", DIGEST]]));
    const chosen = candidateItemsFor("brick_wall", "masonry.brickwork")[0];
    const described = await describeGroups(CTX, asks, portAnswering({ item: chosen?.id }));
    expect(described.get(groupKeyOf("brick_wall", "masonry.brickwork")), "the chosen sentence is held beside the draft, with its ledger row").toEqual({
      text: chosen?.text,
      basis: INTERPRETED,
      callId: "call-1",
    });
  });

  test("carries the no-match answer as DEFAULTED, so the plain description stands and the call still shows", async () => {
    const asks = groupAsksOf([wallLine()], LEVELS, new Map([["d-1", DIGEST]]));
    const described = await describeGroups(CTX, asks, portAnswering({ item: "NONE_OF_THESE" }));
    expect(described.get(groupKeyOf("brick_wall", "masonry.brickwork")), "nothing is chosen, and the call waits on the calibration line").toEqual({
      text: null,
      basis: DEFAULTED,
      callId: "call-1",
    });
  });

  test("lets a refusal pass without touching the draft: the plain description stands and the read goes on", async () => {
    const asks = groupAsksOf([wallLine()], LEVELS, new Map([["d-1", DIGEST]]));
    const described = await describeGroups(CTX, asks, REFUSING);
    expect(described.size, "a state no fixture answers is a fact about the model, never a fault of the draft (L-AI-02)").toBe(0);
  });

  test("the emission bills a group under the chosen description, and under the plain one where none stands", () => {
    const line = {
      lineId: "line-1",
      objectKey: "BW250@1F",
      class: "brick_wall" as const,
      kind: "masonry.brickwork" as const,
      levelId: "l-1f",
      value: "12.500",
      unit: "m3",
      quantityBasis: "TRANSCRIBED",
      selectionBasis: "TRANSCRIBED",
      coverage: "COMPLETE",
    };
    const reading = { project: "P", campaignId: "c", setRevisionId: "s", levels: LEVELS, lines: [line], coverageComplete: true };
    const chosen = candidateItemsFor("brick_wall", "masonry.brickwork")[0];
    const billed = boqDraftPayloadOf({
      ...reading,
      descriptions: new Map([[groupKeyOf("brick_wall", "masonry.brickwork"), { text: chosen?.text ?? null, basis: INTERPRETED, callId: "call-1" }]]),
    });
    expect(billed.sections.flatMap((section) => section.groups.map((group) => group.description)), "the chosen method of measurement is what the draft bills under").toEqual([
      chosen?.text,
    ]);
    const plain = boqDraftPayloadOf(reading);
    expect(plain.sections.flatMap((section) => section.groups.map((group) => group.description)), "with nothing chosen, the draft keeps its own plain description").toEqual([
      "Brick wall · Brickwork",
    ]);
  });
});
