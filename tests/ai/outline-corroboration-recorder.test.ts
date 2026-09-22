// @vitest-environment node
/**
 * The outline-corroboration recorder's own contract (Q-08, L-AI-01): what it asks FOR before it asks
 * anything of a provider.
 *
 * The recording itself is the orchestrator's — it reaches a network, and no lane does. What is
 * judged here is the part that decides WHICH question gets recorded: the flag it cannot go on
 * without, and the four placement shares it measures the evidence under, which are the seeded
 * platform edition's own parameters and not numbers the script spelled. A share read from somewhere
 * else would record an answer to a question no lane ever asks, and the corpus would replay nothing.
 */
import { describe, expect, test } from "vitest";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";
import { seededShares, subjectsOf } from "../../scripts/model-corpus/outline-corroboration";
import type { RecorderContext } from "../../scripts/model-corpus/recorder";

/** The recorder's context, with a `fail` that throws so a refusal can be read in a test. */
function contextOf(options: Record<string, string>): RecorderContext {
  return {
    option: (name) => options[name],
    fail: (message) => {
      throw new Error(message);
    },
    say: () => undefined,
    corpusRoot: "fixtures/model",
  };
}

const throwing = (message: string): never => {
  throw new Error(message);
};

describe("what the recorder measures under", () => {
  test("the four placement shares are the seeded edition's own parameters", () => {
    expect(seededShares(throwing)).toEqual({
      containmentMerge: SEED_EDITION_CONTENT.parameters["placementContainmentMerge"]?.value,
      nearAnchor: SEED_EDITION_CONTENT.parameters["placementNearAnchor"]?.value,
      footprintMin: SEED_EDITION_CONTENT.parameters["placementFootprintMin"]?.value,
      footprintMax: SEED_EDITION_CONTENT.parameters["placementFootprintMax"]?.value,
    });
  });

  test("and the seeded edition states every one of them — a band nobody authored measures nothing (L-MEA-01)", () => {
    for (const parameter of ["placementContainmentMerge", "placementNearAnchor", "placementFootprintMin", "placementFootprintMax"]) {
      expect(SEED_EDITION_CONTENT.parameters[parameter]?.value, `${parameter} is stated by the platform edition every lane pins`).toMatch(/^[0-9]/);
    }
  });
});

describe("what it will not record", () => {
  test("a recording with no drawing named is refused by name, and nothing is ingested", async () => {
    await expect(subjectsOf(contextOf({}))).rejects.toThrow(/--drawing <path>/);
  });
});
