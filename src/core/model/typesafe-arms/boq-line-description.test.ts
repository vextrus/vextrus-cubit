// @vitest-environment node
/**
 * The boq-line-description arm, at the wire (L-BD-01, L-AI-02, L-AI-03, AM-11).
 *
 * What is graded here is what the adapter POSTS and what it READS BACK: the four-key content is
 * recognised as this arm's task and no other's, the body carries the state the question names and
 * the two questions over it, the criteria are the candidates' own ids plus the no-match outcome, the
 * choice is read into `payload.item` and cites exactly the state's own keys, and a request with
 * nothing to choose from or nothing to cite posts no question at all (B-14).
 *
 * The content is spelled here, canonically, because ARCH-01 bars core from reaching the module that
 * composes it: that the draft's own `boqDescriptionRequest` composes exactly this key set is tied
 * down beside the module, in `tests/takeoff/boq/description-proposal.test.ts`.
 */
import { describe, expect, test } from "vitest";
import { candidateItemsFor, type ItemDescriptionRow } from "../../catalogue/item-descriptions";
import { canonicalJson } from "../canonical";
import { structuredTaskOf } from "../typesafe";
import type { ModelRequest } from "../types";
import { NONE_OF_THESE, boqLineDescriptionArm, type DescriptionTask } from "./boq-line-description";

/** The state one description question is asked over, as the draft's request builder spells one. */
type DescriptionState = {
  line: Record<string, unknown>;
  attributes: { name: string; valueAsWritten: string; unitAsWritten: string }[];
  candidates: readonly ItemDescriptionRow[];
  keys: string[];
};

/** One brick wall's group, as the draft states one: the pair the law divides, with a stated thickness. */
function wallState(overrides: Partial<DescriptionState> = {}): DescriptionState {
  return {
    line: {
      class: "brick_wall",
      kind: "masonry.brickwork",
      unit: "m3",
      levels: ["1F", "2F"],
      bill: "SUPERSTRUCTURE",
      decidedBy: "OVERRIDE:brick_wall",
      quantityBasis: "TRANSCRIBED",
      selectionBasis: "TRANSCRIBED",
    },
    attributes: [{ name: "thickness", valueAsWritten: "250", unitAsWritten: "mm" }],
    candidates: candidateItemsFor("brick_wall", "masonry.brickwork"),
    keys: ["DXF_HANDLE:1D4C"],
    ...overrides,
  };
}

/** The request the draft composes over that state: the four-key content, canonically spelled. */
function requestOf(state: DescriptionState): ModelRequest {
  const content = canonicalJson({
    attributes: state.attributes.map((attribute) => ({ name: attribute.name, unitAsWritten: attribute.unitAsWritten, valueAsWritten: attribute.valueAsWritten })),
    candidates: state.candidates.map((candidate) => ({ id: candidate.id, text: candidate.text })),
    keys: [...state.keys],
    line: state.line as Record<string, string | string[]>,
  });
  return { modelId: "claude-sonnet-5", system: "(the draft's own system prompt — not read by any arm)", messages: [{ role: "user", content }] };
}

/** The task the adapter recognises this state's request as, or a failure naming what it recognised. */
function taskOf(state: DescriptionState): DescriptionTask {
  const task = structuredTaskOf(requestOf(state));
  expect(task?.kind, "the registry routes this key set to the boq-line-description arm").toBe("description");
  return task as DescriptionTask;
}

describe("the item-description arm", () => {
  test("recognises the request the draft composes, and reads its state back out of it", () => {
    const state = wallState();
    const task = taskOf(state);
    expect(task.keys, "the citable keys travel on the task, as code chose them").toEqual(["DXF_HANDLE:1D4C"]);
    expect(task.candidates.map((candidate) => candidate.id), "the candidates travel in the catalogue's own order").toEqual(state.candidates.map((row) => row.id));
    expect(task.line, "the line travels whole, as the request canonically spelled it").toMatchObject({ class: "brick_wall", kind: "masonry.brickwork", levels: ["1F", "2F"] });
  });

  test("posts one choice over the candidates plus the no-match outcome, and one noul beside it", () => {
    const state = wallState();
    const body = boqLineDescriptionArm.compose(taskOf(state)).body as {
      model: string;
      state: { line: unknown; attributes: unknown; candidates: { id: string; text: string }[] };
      questions: Record<string, { type: string; instructions: string; criteria?: Record<string, string> }>;
    };
    expect(body.model, "the alias the seam asks for").toBe("jev-latest");
    expect(Object.keys(body.state).sort(), "the state names the line, what is stated of it, and the closed list").toEqual(["attributes", "candidates", "line"]);
    expect(body.state.candidates, "every candidate is put by its own id and its own sentence, in the catalogue's order").toEqual(
      state.candidates.map((row) => ({ id: row.id, text: row.text })),
    );

    const choice = body.questions["item_description"];
    expect(choice?.type).toBe("choice");
    expect(Object.keys(choice?.criteria ?? {}), "the criteria are the candidates' ids and the no-match outcome").toEqual([...state.candidates.map((row) => row.id), NONE_OF_THESE]);
    for (const row of state.candidates) {
      expect(choice?.criteria?.[row.id], `${row.id} is offered as its whole description — a clipped method of measurement is another method (L-BD-01)`).toBe(row.text);
    }
    expect(choice?.instructions, "the instruction names the state by its own field paths").toContain("`attributes`");
    expect(choice?.instructions, "the instruction offers the no-match outcome by name").toContain(NONE_OF_THESE);

    const noul = body.questions["attributes_separate"];
    expect(noul?.type, "the second question is a noul over the same state").toBe("noul");
    expect(noul?.criteria, "a noul whose boundary its instruction states carries no criteria").toBeUndefined();
    expect(noul?.instructions, "the noul asks one yes-or-no, phrased so a high figure means they are told apart").toContain("tells those descriptions apart");
  });

  test("reads a chosen id into the payload and cites exactly the state's own keys", () => {
    const state = wallState({ keys: ["DXF_HANDLE:1D4C", "DXF_HANDLE:20B1"] });
    const chosen = state.candidates[0];
    const read = boqLineDescriptionArm.compose(taskOf(state)).read({
      item_description: { type: "choice", choice: chosen?.id, confidence: 0.91 },
      attributes_separate: { type: "noul", noul: 0.88 },
    });
    expect(read, "the wire the seam resolves: the chosen id, and the keys code cited for it").toEqual({
      payload: { item: chosen?.id },
      sources: ["DXF_HANDLE:1D4C", "DXF_HANDLE:20B1"],
    });
  });

  test("answers the no-match outcome as itself, and an unanswered question as nothing", () => {
    const question = boqLineDescriptionArm.compose(taskOf(wallState()));
    expect(question.read({ item_description: { type: "choice", choice: NONE_OF_THESE } }), "an abstention is carried, never turned into a guess").toMatchObject({
      payload: { item: NONE_OF_THESE },
    });
    expect(question.read({}), "a question Jev did not answer is null, and the caller's decoder refuses it").toMatchObject({ payload: { item: null } });
  });

  test("posts nothing where there is nothing to choose from, or nothing an answer could cite", () => {
    const nothingToChoose = { ...taskOf(wallState()), candidates: [] };
    expect(() => boqLineDescriptionArm.guard?.(nothingToChoose)).toThrow(/no candidate description/u);
    const nothingToCite = { ...taskOf(wallState()), keys: [] };
    expect(() => boqLineDescriptionArm.guard?.(nothingToCite)).toThrow(/no source key/u);
    expect(() => boqLineDescriptionArm.guard?.(taskOf(wallState())), "a whole state is posted").not.toThrow();
  });

  test("recognises nothing in content that wears the key set but is not this question", () => {
    const notCandidates = { attributes: [], candidates: [{ id: "one", text: 7 }], keys: ["DXF_HANDLE:1"], line: {} };
    expect(boqLineDescriptionArm.recognise(notCandidates), "a candidate whose description is not a sentence is no candidate").toBeNull();
    const notKeys = { attributes: [], candidates: [], keys: "DXF_HANDLE:1", line: {} };
    expect(boqLineDescriptionArm.recognise(notKeys), "citations are a list of keys, never one string").toBeNull();
    const notALine = { attributes: [], candidates: [], keys: [], line: "brick_wall" };
    expect(boqLineDescriptionArm.recognise(notALine), "a line is the object the draft states, never a word").toBeNull();
  });
});
