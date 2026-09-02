// The token-count judgement and the rate table (L-AI-01, B-17): one exported judgement that the
// derivation and the transports share, one sentence for a figure that fails it, and rates that
// cannot be rewritten while the process runs.
import { describe, expect, it } from "vitest";
import { MODEL_IDS, MODEL_RATES, isTokenCount, modelCallCost, tokenCount } from "./model-ledger.types";

/** The value a synchronous call threw, or undefined when it returned — no catch clause of the test's own. */
const thrownBy = (call: () => unknown): Promise<unknown> =>
  Promise.resolve()
    .then(call)
    .then(
      () => undefined,
      (reason: unknown) => reason,
    );

describe("isTokenCount is the one judgement", () => {
  it("answers true for a safe non-negative integer and false for everything else", () => {
    for (const count of [0, 1, 4096, Number.MAX_SAFE_INTEGER]) expect(isTokenCount(count), `${count}`).toBe(true);
    for (const figure of [-1, 0.5, 1.5, "7", Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, {}, []]) {
      expect(isTokenCount(figure), String(figure)).toBe(false);
    }
  });

  it("tokenCount answers the figure it was given and fails with the sentence modelCallCost fails with", async () => {
    expect(tokenCount(12)).toBe(12);
    for (const figure of [-1, 1.5, "7"]) {
      const direct = (await thrownBy(() => tokenCount(figure))) as Error;
      const derived = (await thrownBy(() => modelCallCost(MODEL_IDS[0], figure as number, 0))) as Error;
      expect(direct, String(figure)).toBeInstanceOf(Error);
      expect(derived.message, `modelCallCost fails through tokenCount for ${String(figure)}`).toBe(direct.message);
      expect(direct.message).toContain("is not a token count");
    }
  });
});

describe("MODEL_RATES is frozen at every depth", () => {
  it("refuses a reassigned rate and a rewritten field alike, and still answers the pinned rate", async () => {
    expect(Object.isFrozen(MODEL_RATES)).toBe(true);
    for (const modelId of MODEL_IDS) expect(Object.isFrozen(MODEL_RATES[modelId]), modelId).toBe(true);
    const mutable = MODEL_RATES as unknown as Record<string, Record<string, string>>;
    const [first] = MODEL_IDS;
    expect(await thrownBy(() => (mutable[first] = { inputPerMillionTokens: "0", outputPerMillionTokens: "0" }))).toBeInstanceOf(TypeError);
    expect(await thrownBy(() => (mutable[first]!["inputPerMillionTokens"] = "0"))).toBeInstanceOf(TypeError);
    expect(modelCallCost(first, 1_000_000, 0)).toBe(MODEL_RATES[first].inputPerMillionTokens);
  });
});
