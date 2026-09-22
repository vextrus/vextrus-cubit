// @vitest-environment node
/**
 * The outline-corroboration arm, at the wire (L-AI-01, L-AI-02, L-QTY-04).
 *
 * Every exchange here is with a fetch the test hands in: the unit lane is network-free and no key is
 * spelled anywhere in the tree. What is judged is what the adapter posts for the request
 * `@/core/outline-corroboration` composes — ONE Noul, over the request's own state, with
 * instructions that name every field by its backticked path — how the answer is read into the wire
 * the seam resolves, and what the arm will NOT do: supply a probability Jev did not state, cite a
 * key the request does not name, or post a question about an outline nothing identifies.
 */
import { describe, expect, test } from "vitest";
import { outlineCorroborationRequest, readCorroborationProposal, type OutlineEvidence } from "../../outline-corroboration";
import { liveTransport } from "../live";
import { MODEL_QUESTIONS } from "../questions";
import { TYPESAFE_ENDPOINT, TYPESAFE_MODEL } from "../typesafe";
import { structuredTaskOf } from "../typesafe";
import type { ModelCallContext, ModelRequest } from "../types";
import { OUTLINE_KEYS, OUTLINE_QUESTION_ID, outlineCorroborationArm } from "./outline-corroboration";

const CTX: ModelCallContext = {
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  projectId: "d3e00000-0000-4000-8000-000000000002",
  actor: "user:test",
  requestId: "req-test-outline-1",
};

/** One placed outline, as `outlineEvidenceOf` finds one: a C4 drawn at the section its schedule states. */
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

type Posted = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
type Asked = Record<string, { type: string; instructions: string; criteria?: unknown }>;

/** A transport over a fetch that records what was posted and answers what the test says. */
function jev(answerWith: unknown): { port: ReturnType<typeof liveTransport>; posted: Posted[] } {
  const posted: Posted[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    posted.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(JSON.stringify(answerWith), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { port: liveTransport({ TYPESAFE_API_KEY: "test-key" }, fetch), posted };
}

/** One answer body, as the API spells a Noul (docs.typesafe.ai/primitives/noul). */
const answers = (noul: unknown): unknown => ({
  model: TYPESAFE_MODEL,
  answers: { [OUTLINE_QUESTION_ID]: { type: "noul", noul } },
  usage: { input_tokens: 420, output_tokens: 12 },
});

describe("what is asked of Jev about one interpreted outline", () => {
  test("the corroboration request is recognised by its own key set, and by nothing else", () => {
    const task = structuredTaskOf(outlineCorroborationRequest(EVIDENCE));
    expect(task?.kind).toBe("outline");
    expect(task?.kind === "outline" && Object.keys(task.state).sort()).toEqual([...OUTLINE_KEYS]);
    expect(task?.kind === "outline" && task.outlineKey).toBe(EVIDENCE.outlineKey);
    expect(task?.kind === "outline" && task.markKey).toBe(EVIDENCE.markKey);
    expect(outlineCorroborationArm.question).toBe(MODEL_QUESTIONS.outlineCorroboration);
  });

  test("it is ONE Noul over the request's own state, and the state is passed through whole", async () => {
    const { port, posted } = jev(answers(0.93));
    const request = outlineCorroborationRequest(EVIDENCE);
    await port.answer(CTX, request, "hash-outline");
    expect(posted).toHaveLength(1);
    const [call] = posted as [Posted];
    expect(call.url).toBe(TYPESAFE_ENDPOINT);
    expect(call.headers["Authorization"]).toBe("Bearer test-key");
    expect(call.body["model"]).toBe(TYPESAFE_MODEL);
    // The state posted IS the request's canonical content — what the hash was taken over, so what
    // was recorded is what was asked (L-AI-01).
    expect(call.body["state"]).toEqual(JSON.parse(request.messages[0]?.content ?? "{}"));
    const asked = call.body["questions"] as Asked;
    expect(Object.keys(asked)).toEqual([OUTLINE_QUESTION_ID]);
    expect(asked[OUTLINE_QUESTION_ID]?.type).toBe("noul");
    // A Noul states no criteria: its whole meaning is its own instructions (the docs' guidance).
    expect(asked[OUTLINE_QUESTION_ID]).not.toHaveProperty("criteria");
  });

  test("the instructions name every field of the state by its backticked path, and say what a yes and a no mean", async () => {
    const { port, posted } = jev(answers(0.42));
    await port.answer(CTX, outlineCorroborationRequest(EVIDENCE), "hash-outline");
    const instructions = ((posted[0] as Posted).body["questions"] as Asked)[OUTLINE_QUESTION_ID]?.instructions ?? "";
    for (const key of OUTLINE_KEYS) {
      if (key === "outlineKey" || key === "markKey") continue; // the two citations: keys, not figures to reason over
      expect(instructions, `the question names \`${key}\`, a field of the state it reasons over`).toContain(`\`${key}\``);
    }
    expect(instructions, "what a yes means").toContain("Answer yes");
    expect(instructions, "what a no means").toContain("Answer no");
    expect(instructions.length, "the question carries its whole meaning, not only its field names").toBeGreaterThan(400);
  });
});

describe("what comes back", () => {
  test("a Noul reads as the probability it is, citing the outline and the mark the request named", async () => {
    const { port } = jev(answers(0.93));
    const answer = await port.answer(CTX, outlineCorroborationRequest(EVIDENCE), "hash-outline");
    expect(answer.kind).toBe("answered");
    if (answer.kind !== "answered") return;
    expect(answer.payload).toEqual({ payload: { corroborates: 0.93 }, sources: [EVIDENCE.outlineKey, EVIDENCE.markKey] });
    // The probability is the answer's VALUE and the Noul states no confidence, so this question's
    // call carries none: the band `../../outline-corroboration/law` applies is read off the value,
    // and the calibration line's two means have nothing to average for it and say so.
    expect(answer.judgment?.answers[OUTLINE_QUESTION_ID]).toEqual({ type: "noul", value: 0.93, confidence: null, probabilities: null });
    expect(answer.judgment?.confidence, "a call of Nouls alone states no confidence at all").toBeNull();
  });

  test("nothing is supplied where Jev supplied nothing: a Noul that is no figure is null, and the reading is refused", async () => {
    const { port } = jev(answers("very likely"));
    const answer = await port.answer(CTX, outlineCorroborationRequest(EVIDENCE), "hash-outline");
    if (answer.kind !== "answered") throw new Error(`refused: ${answer.code}`);
    const wire = answer.payload as { payload: { corroborates: number | null } };
    expect(wire.payload.corroborates).toBeNull();
    const read = readCorroborationProposal(wire.payload);
    expect(read.ok, "a corroboration that states no probability is no reading a caller may take").toBe(false);
  });

  test("a request naming no outline posts no question at all", async () => {
    const { port, posted } = jev(answers(0.93));
    const blind: ModelRequest = outlineCorroborationRequest({ ...EVIDENCE, outlineKey: "" });
    const task = structuredTaskOf(blind);
    if (task?.kind !== "outline") throw new Error("the blind request is still this arm's, and the guard is what refuses it");
    // Infrastructure's fault and never a product decision (B-14): the arm throws, and the transport
    // carries that throw out as a fault id rather than as a refusal a person could act on.
    expect(() => outlineCorroborationArm.guard?.(task)).toThrow(/no question was posted/);
    await expect(port.answer(CTX, blind, "hash-blind")).rejects.toThrow(/was not answered/);
    expect(posted, "nothing is posted for a question the arm refuses to ask").toHaveLength(0);
  });
});
