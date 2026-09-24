// @vitest-environment node
/**
 * The ask-route arm (R-AI-003, s-ask I-396, I-397): recognised by its own key set, refused where
 * nothing could be cited, composed as one choice over the roster the request carries plus the no-match
 * outcome, one choice per slot the words name two subjects of, and read back citing every keyed
 * candidate it was offered.
 */
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../canonical";
import { MODEL_QUESTIONS } from "../questions";
import { structuredTaskOf } from "../typesafe";
import type { ModelRequest } from "../types";
import { ASK_ROUTE_NONE, ASK_ROUTE_NOT_STATED, askRouteArm, doubledSlots, type RouteTask } from "./ask-route";

const ROSTER = { digest: "0123456789abcdef", intents: [{ intent: "COUNT", means: "How many." }, { intent: "QUANTITY", means: "How much." }] };

function request(content: Record<string, unknown>): ModelRequest {
  return { modelId: "jev-latest", system: "", messages: [{ role: "user", content: canonicalJson(content as never) }] };
}

function task(candidates: RouteTask["candidates"]): RouteTask {
  return { kind: "route", question: "tally c3 not c4 on gf", candidates, digest: ROSTER.digest, intents: ROSTER.intents };
}

describe("the ask-route arm", () => {
  it("is the routing question, recognised by candidates, question and roster — and by nothing thinner", () => {
    expect(askRouteArm.question).toBe(MODEL_QUESTIONS.askRoute);
    const recognised = structuredTaskOf(request({ candidates: [{ slot: "mark", label: "C3", key: "DXF_HANDLE:26" }], question: "tally c3", roster: ROSTER }));
    expect(recognised?.kind).toBe("route");
    expect(structuredTaskOf(request({ candidates: [{ slot: "mark", label: "C3", key: 7 }], question: "tally c3", roster: ROSTER })), "a key that is not a string or null").toBeNull();
    expect(structuredTaskOf(request({ candidates: [], question: "tally c3", roster: { digest: "x", intents: [{ intent: "COUNT" }] } })), "an intent with no meaning").toBeNull();
  });

  it("posts nothing where no candidate carries a key, or the roster is empty (I-397)", () => {
    expect(() => askRouteArm.guard?.(task([{ slot: "class", label: "column", key: null }]))).toThrow(/no subject with a source key/u);
    expect(() => askRouteArm.guard?.({ ...task([{ slot: "mark", label: "C3", key: "DXF_HANDLE:26" }]), intents: [] })).toThrow(/empty intent roster/u);
    expect(() => askRouteArm.guard?.(task([{ slot: "mark", label: "C3", key: "DXF_HANDLE:26" }]))).not.toThrow();
  });

  it("asks the intent over the roster plus none of these, and a slot only where the words name two of it", () => {
    const one = task([{ slot: "class", label: "column", key: null }, { slot: "mark", label: "C3", key: "DXF_HANDLE:26" }, { slot: "level", label: "GF", key: "DXF_HANDLE:11" }]);
    const body = askRouteArm.compose(one).body as { questions: Record<string, { criteria: Record<string, string> }>; state: Record<string, unknown> };
    expect(Object.keys(body.questions)).toEqual(["intent"]);
    expect(Object.keys(body.questions["intent"]?.criteria ?? {})).toEqual(["COUNT", "QUANTITY", ASK_ROUTE_NONE]);
    expect(JSON.stringify(body.state), "the keys are what an answer rests on, never state").not.toContain("DXF_HANDLE");

    const two = task([{ slot: "mark", label: "C3", key: "DXF_HANDLE:26" }, { slot: "mark", label: "C4", key: "DXF_HANDLE:28" }]);
    expect(doubledSlots(two.candidates)).toEqual(["mark"]);
    const doubled = askRouteArm.compose(two).body as { questions: Record<string, { criteria: Record<string, string> }> };
    expect(Object.keys(doubled.questions["slot_mark"]?.criteria ?? {})).toEqual(["C3", "C4", ASK_ROUTE_NOT_STATED]);
  });

  it("reads the answers into the wire, citing every keyed candidate offered once", () => {
    const two = task([
      { slot: "mark", label: "C3", key: "DXF_HANDLE:26" },
      { slot: "mark", label: "C4", key: "DXF_HANDLE:28" },
      { slot: "level", label: "GF", key: "DXF_HANDLE:11" },
      { slot: "class", label: "column", key: null },
    ]);
    const read = askRouteArm.compose(two).read({ intent: { choice: "COUNT" }, slot_mark: { choice: "C3" } });
    expect(read).toEqual({ payload: { intent: "COUNT", slots: { mark: "C3" } }, sources: ["DXF_HANDLE:26", "DXF_HANDLE:28", "DXF_HANDLE:11"] });
    expect(askRouteArm.compose(two).read({}), "no choice read as none, never supplied").toEqual({ payload: { intent: null, slots: { mark: null } }, sources: ["DXF_HANDLE:26", "DXF_HANDLE:28", "DXF_HANDLE:11"] });
  });
});
